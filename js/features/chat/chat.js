// ============ Chat Styling ============
// Friend borders, dev badges, BetterNow user badges, light mode fixes, username coloring

function isLightMode() {
    // Check for data-theme="light" attribute on any element (usually html or body)
    return document.querySelector('[data-theme="light"]') !== null;
}

// Inject CSS to fix light mode text colors
function injectLightModeStyles() {
    if (document.getElementById('betternow-lightmode-styles')) return;

    const style = document.createElement('style');
    style.id = 'betternow-lightmode-styles';
    style.textContent = `
        [data-theme="light"] .user-card__body {
            color: var(--color-darkgray, #333) !important;
        }
    `;
    document.head.appendChild(style);
}

// Call this early to ensure styles are injected
injectLightModeStyles();

// Apply gradient border to a card element
function applyGradientBorder(card, color1, color2) {
    if (!color1) return;

    // Skip if already processed
    if (card.querySelector('.betternow-inner')) return;

    // If same color or no second color, use simple border
    if (!color2 || color1.toLowerCase() === color2.toLowerCase()) {
        card.style.border = `1px solid ${color1}`;
        card.style.borderRadius = '8px';
        return;
    }

    // For gradient border: set gradient as background, create inner container for content
    card.style.border = 'none';
    card.style.borderRadius = '8px';
    card.style.padding = '1px';
    card.style.background = `linear-gradient(135deg, ${color1}, ${color2})`;

    // Create inner container that will hold the content with the background color
    const inner = document.createElement('div');
    inner.className = 'betternow-inner';
    inner.style.cssText = `
        background: var(--background-color, #212121);
        border-radius: 7px;
        display: flex;
        align-items: flex-start;
        width: 100%;
        padding: 0.5rem;
        gap: 0.5rem;
    `;

    // Move all children into inner
    while (card.firstChild) {
        inner.appendChild(card.firstChild);
    }
    card.appendChild(inner);
}

// Check if a user ID should get the developer badge
function isDeveloper(userId) {
    return DEVELOPER_USER_IDS.includes(String(userId));
}

// Check if a user ID is online with BetterNow (from presence system)
function isOnlineWithBetterNow(userId) {
    // Check window global (set by active-users.js)
    if (typeof window.onlineBetterNowUserIds !== 'undefined' && window.onlineBetterNowUserIds instanceof Set) {
        return window.onlineBetterNowUserIds.has(String(userId));
    }
    // Fallback to local variable if exists
    if (typeof onlineBetterNowUserIds !== 'undefined' && onlineBetterNowUserIds instanceof Set) {
        return onlineBetterNowUserIds.has(String(userId));
    }
    return false;
}

// Get user ID from a chat message li element (extracts from avatar URL)
function getUserIdFromChatMessage(li) {
    const avatar = li.querySelector('app-user-thumb img');
    if (avatar && avatar.src) {
        const match = avatar.src.match(/\/(\d+)\/\d+\.jpg/);
        if (match) return match[1];
    }
    return null;
}

// ============ Developer Badges ============
// Apply developer badge to all developers in chat

function applyDeveloperBadges() {
    document.querySelectorAll('app-chat-list li').forEach(li => {
        const userId = getUserIdFromChatMessage(li);
        if (userId && isDeveloper(userId)) {
            // First check if badge already exists
            if (li.querySelector('.betternow-dev-badge')) return;

            // Try to find existing badge list
            let badgeList = li.querySelector('user-badges .user-badge ul.badge-list');

            // If no badge wrapper exists (user has no native badges), create one
            if (!badgeList) {
                const header = li.querySelector('.user-card__header');
                if (!header) return;

                // Check if there's already a user-badges-wrapper
                let badgesWrapper = header.querySelector('.user-badges-wrapper');
                if (!badgesWrapper) {
                    // Create the full badge structure
                    badgesWrapper = document.createElement('div');
                    badgesWrapper.className = 'user-badges-wrapper ng-star-inserted';
                    badgesWrapper.innerHTML = `
                        <user-badges>
                            <div class="user-badge is-small">
                                <ul class="badge-list ng-star-inserted"></ul>
                            </div>
                        </user-badges>
                    `;
                    // Insert at the beginning of the header
                    header.insertBefore(badgesWrapper, header.firstChild);
                }

                badgeList = badgesWrapper.querySelector('ul.badge-list');
            }

            if (badgeList && !badgeList.querySelector('.betternow-dev-badge')) {
                const devBadgeLi = document.createElement('li');
                devBadgeLi.className = 'ng-star-inserted';
                devBadgeLi.style.cssText = 'display: inline-flex; align-items: center;';
                const devBadge = document.createElement('img');
                devBadge.src = 'https://cdn3.emoji.gg/emojis/1564-badge-developer.png';
                devBadge.className = 'betternow-dev-badge special-badges';
                devBadge.alt = 'BetterNow Developer';
                devBadge.title = 'BetterNow Developer';
                devBadge.style.cssText = 'width: 16px; height: 16px; margin-right: 4px;';
                devBadgeLi.appendChild(devBadge);
                badgeList.appendChild(devBadgeLi);
            }
        }
    });
}

// ============ BetterNow User Badges ============
// Apply LIT badge to users who are online with BetterNow

function applyBetterNowUserBadges() {
    const onlineUsers = window.onlineBetterNowUserIds || [];

    document.querySelectorAll('app-chat-list li').forEach(li => {
        const userId = getUserIdFromChatMessage(li);
        if (!userId) return;

        // Skip if user is not online with BetterNow
        if (!isOnlineWithBetterNow(userId)) return;

        // Mark this user as a BetterNow user (for CSS styling like online indicator)
        li.setAttribute('data-betternow-user', 'true');

        // Also mark the user-thumb for audience list styling
        const userThumb = li.querySelector('.user-thumb');
        if (userThumb) {
            userThumb.setAttribute('data-betternow-user', 'true');
        }

        // Skip admin/developer accounts (they get developer badge instead)
        if (typeof ADMIN_USER_IDS !== 'undefined' && ADMIN_USER_IDS.includes(userId)) {
            return;
        }

        // Skip if badge already exists
        if (li.querySelector('.betternow-user-badge')) {
            return;
        }

        // Try to find existing badge list
        let badgeList = li.querySelector('user-badges .user-badge ul.badge-list');

        // If no badge wrapper exists (user has no native badges), create one
        if (!badgeList) {
            const header = li.querySelector('.user-card__header');
            if (!header) return;

            // Check if there's already a user-badges-wrapper
            let badgesWrapper = header.querySelector('.user-badges-wrapper');
            if (!badgesWrapper) {
                // Create the full badge structure
                badgesWrapper = document.createElement('div');
                badgesWrapper.className = 'user-badges-wrapper ng-star-inserted';
                badgesWrapper.innerHTML = `
                    <user-badges>
                        <div class="user-badge is-small">
                            <ul class="badge-list ng-star-inserted"></ul>
                        </div>
                    </user-badges>
                `;
                // Insert at the beginning of the header
                header.insertBefore(badgesWrapper, header.firstChild);
            }

            badgeList = badgesWrapper.querySelector('ul.badge-list');
        }

        if (badgeList && !badgeList.querySelector('.betternow-user-badge')) {
            const badgeUrl = (typeof betternowUserStyle !== 'undefined' && betternowUserStyle.badgeUrl)
                ? betternowUserStyle.badgeUrl
                : '';

            // Only add badge if URL is configured
            if (badgeUrl) {
                const badgeLi = document.createElement('li');
                badgeLi.className = 'ng-star-inserted';
                badgeLi.style.cssText = 'display: inline-flex; align-items: center;';
                const badge = document.createElement('img');
                badge.src = badgeUrl;
                badge.className = 'betternow-user-badge special-badges';
                badge.alt = 'BetterNow User';
                badge.title = 'BetterNow User';
                badge.style.cssText = 'width: 16px; height: 16px; margin-right: 4px;';
                badgeLi.appendChild(badge);
                badgeList.appendChild(badgeLi);
            }
        }
    });
}

// ============ Chat Styles ============
// Apply borders, level colors, name colors, and avatar frames

function applyChatStyles() {
    // Apply styles for my username (primary account)
    document.querySelectorAll(`span[title="${myUsername}"]`).forEach(span => {
        const li = span.closest('li');
        if (li && li.closest('app-chat-list')) {
            const card = li.querySelector('.user-card');
            if (card && mySettings.borderEnabled && mySettings.borderColor1) {
                applyGradientBorder(card, mySettings.borderColor1, mySettings.borderColor2);
            }

            const comment = li.querySelector('.comment');
            if (comment) {
                // Preserve special classes like is-platinium, is-golden, broadcaster-mod, etc.
                const specialClasses = ['is-platinium', 'is-golden', 'broadcaster-mod', 'is-five-red-crowns', 'is-broadcaster'];
                const classesToKeep = specialClasses.filter(cls => comment.classList.contains(cls));
                comment.className = 'comment ng-star-inserted ' + classesToKeep.join(' ');
            }

            const levelBadge = li.querySelector('app-user-level .user-level');
            if (levelBadge && mySettings.levelEnabled && mySettings.levelColor1) {
                const levelGradient = mySettings.levelColor2
                    ? `linear-gradient(135deg, ${mySettings.levelColor1}, ${mySettings.levelColor2})`
                    : mySettings.levelColor1;
                levelBadge.style.background = levelGradient;
                levelBadge.style.borderRadius = '9px';
                levelBadge.style.padding = '.125rem .5rem';
                levelBadge.style.color = '#fff';
            }

            const usernameSpan = li.querySelector(`span[title="${myUsername}"]`);
            if (usernameSpan && mySettings.textColor) {
                usernameSpan.style.setProperty('color', mySettings.textColor, 'important');
            }

            const avatarThumb = li.querySelector('app-user-thumb .user-thumb');
            if (avatarThumb && mySettings.frameEnabled && mySettings.frameUrl) {
                const existingBorder = avatarThumb.querySelector('.custom-avatar-border');
                if (!existingBorder) {
                    const borderImg = document.createElement('img');
                    borderImg.src = mySettings.frameUrl;
                    borderImg.className = 'custom-avatar-border';
                    borderImg.style.cssText = `
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 134%;
                        height: auto;
                        pointer-events: none;
                        z-index: 1;
                    `;
                    avatarThumb.style.position = 'relative';
                    avatarThumb.appendChild(borderImg);
                }
            }
        }
    });

    // Apply styles for friend usernames
    friendUserIds.forEach(odiskd => {
        const userData = friendUsers[odiskd] || {};
        const username = userData.username;
        if (!username) return;

        const settings = friendSettings[odiskd] || {};

        document.querySelectorAll(`span[title="${username}"]`).forEach(span => {
            const li = span.closest('li');
            if (li && li.closest('app-chat-list')) {
                const card = li.querySelector('.user-card');

                // Apply border if enabled
                if (card && settings.borderEnabled && settings.borderColor1) {
                    applyGradientBorder(card, settings.borderColor1, settings.borderColor2);
                }

                const comment = li.querySelector('.comment');
                if (comment) {
                    // Preserve special classes like is-platinium, is-golden, broadcaster-mod, etc.
                    const specialClasses = ['is-platinium', 'is-golden', 'broadcaster-mod', 'is-five-red-crowns', 'is-broadcaster'];
                    const classesToKeep = specialClasses.filter(cls => comment.classList.contains(cls));
                    comment.className = 'comment ng-star-inserted ' + classesToKeep.join(' ');
                }

                // Apply text color if set
                if (settings.textColor) {
                    const usernameSpan = li.querySelector(`span[title="${username}"]`);
                    if (usernameSpan) {
                        usernameSpan.style.setProperty('color', settings.textColor, 'important');
                    }
                }

                // Apply level background if enabled
                if (settings.levelEnabled && settings.levelColor1) {
                    const levelBadge = li.querySelector('app-user-level .user-level');
                    if (levelBadge) {
                        if (settings.levelColor2) {
                            levelBadge.style.background = `linear-gradient(115.62deg, ${settings.levelColor1} 17.43%, ${settings.levelColor2} 84.33%)`;
                        } else {
                            levelBadge.style.background = settings.levelColor1;
                        }
                        levelBadge.style.borderRadius = '9px';
                        levelBadge.style.padding = '.125rem .5rem';
                        levelBadge.style.color = '#fff';
                    }
                }
            }
        });
    });

    // Apply developer badges (sync - no presence dependency)
    applyDeveloperBadges();

    // NOTE: BetterNow user badges and audience markers are applied separately
    // by applyPresenceStyles() after presence data loads - keeps styling instant
}

// ============ Presence-Dependent Styling ============
// Called by active-users.js after presence data is fetched
// Separated from applyChatStyles() so borders/colors load instantly

function applyPresenceStyles() {
    // Apply BetterNow user badges (requires presence data)
    applyBetterNowUserBadges();

    // Mark BetterNow users in audience list (for online indicator styling)
    markBetterNowUsersInAudience();
}

// Throttle applyChatStyles to prevent excessive calls
// Runs immediately on trigger, then blocks for 250ms
let chatStylesThrottleTimer = null;
const CHAT_STYLES_THROTTLE_MS = 250;

function throttledApplyChatStyles() {
    // If throttle active, skip
    if (chatStylesThrottleTimer) return;

    // Run immediately
    applyChatStyles();

    // Block subsequent calls for 250ms
    chatStylesThrottleTimer = setTimeout(() => {
        chatStylesThrottleTimer = null;
    }, CHAT_STYLES_THROTTLE_MS);
}

function observeChat() {
    const chatContainer = document.querySelector('app-chat-list');
    if (chatContainer && !chatContainer.hasAttribute('data-observing')) {
        const chatObserver = new MutationObserver(() => {
            throttledApplyChatStyles();
        });
        chatObserver.observe(chatContainer, { childList: true, subtree: true });
        chatContainer.setAttribute('data-observing', 'true');
    }
}

// ============ Online Indicator Styling ============
// Inject CSS to style the online indicator dot for BetterNow users

function updateBetterNowOnlineIndicatorStyle() {
    const color = (typeof betternowUserStyle !== 'undefined' && betternowUserStyle.onlineColor)
        ? betternowUserStyle.onlineColor
        : '#820ad0';

    let style = document.getElementById('betternow-online-indicator-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'betternow-online-indicator-style';
        document.head.appendChild(style);
    }

    style.textContent = `
        .viewer-wrapper[data-betternow-user="true"] .online-badge .circle,
        .user-thumb[data-betternow-user="true"] .online-badge .circle,
        li[data-betternow-user="true"] .online-badge .circle {
            fill: ${color} !important;
        }
    `;
}

// Mark BetterNow users in audience list (for online indicator styling)
function markBetterNowUsersInAudience() {
    document.querySelectorAll('app-audience .viewer-wrapper').forEach(wrapper => {
        // Get userId from avatar URL
        const avatar = wrapper.querySelector('img.avatar');
        if (!avatar || !avatar.src) return;

        const match = avatar.src.match(/\/(\d+)\/\d+\.jpg/);
        if (!match) return;

        const userId = match[1];

        // Check if user is online with BetterNow
        if (isOnlineWithBetterNow(userId)) {
            wrapper.setAttribute('data-betternow-user', 'true');

            // Also mark the user-thumb
            const userThumb = wrapper.querySelector('.user-thumb');
            if (userThumb) {
                userThumb.setAttribute('data-betternow-user', 'true');
            }
        }
    });
}

// Initialize online indicator style when settings load
function initOnlineIndicatorStyle() {
    // Always update the style - use default color if not set
    updateBetterNowOnlineIndicatorStyle();
}

// Debug function - call from console: debugOnlineIndicator()
window.debugOnlineIndicator = function() {
    const onlineUsers = window.onlineBetterNowUserIds || new Set();
    console.log('[BetterNow Debug] Online BetterNow users:', [...onlineUsers]);
    console.log('[BetterNow Debug] betternowUserStyle:', typeof betternowUserStyle !== 'undefined' ? betternowUserStyle : 'not defined');

    const style = document.getElementById('betternow-online-indicator-style');
    console.log('[BetterNow Debug] CSS injected:', style ? style.textContent : 'NOT FOUND');

    const markedElements = document.querySelectorAll('[data-betternow-user="true"]');
    console.log('[BetterNow Debug] Elements marked with data-betternow-user:', markedElements.length);
    markedElements.forEach(el => console.log('  -', el.className || el.tagName));

    const audienceViewers = document.querySelectorAll('app-audience .viewer-wrapper');
    console.log('[BetterNow Debug] Audience viewers found:', audienceViewers.length);
    audienceViewers.forEach(v => {
        const avatar = v.querySelector('img.avatar');
        const match = avatar?.src?.match(/\/(\d+)\/\d+\.jpg/);
        const userId = match ? match[1] : 'no-match';
        const isOnline = isOnlineWithBetterNow(userId);
        const isMarked = v.getAttribute('data-betternow-user');
        console.log(`  - userId: ${userId}, isOnlineWithBetterNow: ${isOnline}, marked: ${isMarked}`);
    });
};

// Observe audience list for changes
function observeAudience() {
    const audienceContainer = document.querySelector('app-audience');
    if (audienceContainer && !audienceContainer.hasAttribute('data-betternow-observing')) {
        const audienceObserver = new MutationObserver(() => {
            markBetterNowUsersInAudience();
        });
        audienceObserver.observe(audienceContainer, { childList: true, subtree: true });
        audienceContainer.setAttribute('data-betternow-observing', 'true');

        // Initial mark
        markBetterNowUsersInAudience();
    }
}

// Call on load (will be called again after Firebase loads)
initOnlineIndicatorStyle();