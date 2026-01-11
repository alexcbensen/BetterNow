// ============ Active Users ============
// Detect and badge other BetterNow users in chat

const BETTERNOW_USER_BADGE_URL = 'https://ynassets.younow.com/dashboards/achievements/live/assets/LIFETIME_LIKES_500_UNLOCKED/web_LIFETIME_LIKES_500_UNLOCKED.svg?1';

// Mark current user's chat messages with BetterNow attribute
function markOwnChatMessages() {
    if (!currentUserId) return;
    
    // Find chat messages from current user by their avatar URL containing their userId
    const chatMessages = document.querySelectorAll('app-chat-list li:not([data-betternow])');
    
    chatMessages.forEach(li => {
        // Check if this message is from the current user
        const avatarImg = li.querySelector('app-user-thumb img.avatar');
        if (avatarImg && avatarImg.src.includes(`/${currentUserId}/`)) {
            // Mark this message as from a BetterNow user
            li.setAttribute('data-betternow', 'user');
        }
    });
}

// Detect other BetterNow users and add badges
function detectBetterNowUsers() {
    // Find all chat messages marked as BetterNow users
    const betternowMessages = document.querySelectorAll('app-chat-list li[data-betternow="user"]');
    
    betternowMessages.forEach(li => {
        // Skip if already badged
        if (li.querySelector('.betternow-user-badge')) return;
        
        // Skip admin accounts (they get developer badge instead)
        const avatarImg = li.querySelector('app-user-thumb img.avatar');
        if (avatarImg) {
            const isAdmin = ADMIN_USER_IDS.some(adminId => avatarImg.src.includes(`/${adminId}/`));
            if (isAdmin) return;
        }
        
        // Find the badge list
        const badgeList = li.querySelector('user-badges .user-badge ul.badge-list');
        if (!badgeList) return;
        
        // Skip if already has the badge
        if (badgeList.querySelector('.betternow-user-badge')) return;
        
        // Add BetterNow User badge
        const badgeLi = document.createElement('li');
        badgeLi.className = 'ng-star-inserted';
        badgeLi.style.cssText = 'display: inline-flex; align-items: center;';
        
        const badge = document.createElement('img');
        badge.src = BETTERNOW_USER_BADGE_URL;
        badge.className = 'betternow-user-badge special-badges';
        badge.alt = 'BetterNow User';
        badge.title = 'BetterNow User';
        badge.style.cssText = 'width: 16px; height: 16px; margin-right: 4px;';
        
        badgeLi.appendChild(badge);
        badgeList.appendChild(badgeLi);
    });
}

// Initialize active users feature
function initActiveUsers() {
    // Mark own messages and detect others periodically
    // This runs alongside the chat observer
    markOwnChatMessages();
    detectBetterNowUsers();
}

// Observe chat for new messages
function observeActiveUsers() {
    const chatContainer = document.querySelector('app-chat-list');
    if (chatContainer && !chatContainer.hasAttribute('data-betternow-observing')) {
        const observer = new MutationObserver(() => {
            markOwnChatMessages();
            detectBetterNowUsers();
        });
        observer.observe(chatContainer, { childList: true, subtree: true });
        chatContainer.setAttribute('data-betternow-observing', 'true');
    }
}

// Set up observer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeActiveUsers);
} else {
    observeActiveUsers();
}
