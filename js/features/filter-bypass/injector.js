/*
 * Alex's BetterNow - Filter Bypass Early Injector
 * This runs at document_start to inject the filter bypass before Angular/Zone.js loads
 */

// Check if current user is blocked (stored in localStorage by script.js)
function isUserBlocked() {
    const blockedUsersJson = localStorage.getItem('betternow_blockedUserIds');
    const currentUserId = localStorage.getItem('betternow_currentUserId');

    if (!blockedUsersJson || !currentUserId) return false;

    try {
        const blockedUsers = JSON.parse(blockedUsersJson);
        return blockedUsers.includes(currentUserId) || blockedUsers.includes(String(currentUserId));
    } catch (e) {
        return false;
    }
}

// Only inject if filter bypass is enabled AND user is not blocked
if (localStorage.getItem('betternow_chatFilterBypass') === 'true' && !isUserBlocked()) {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('js/features/filter-bypass/filter-bypass.js');
    script.onload = function() {
        this.remove();
    };
    // Inject immediately into the page
    (document.head || document.documentElement).appendChild(script);
}