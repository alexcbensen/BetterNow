// ============ Badges ============
// Profile modal badges and future badge features

function addDevBadgeToProfileModal() {
    // Find profile modals
    const modals = document.querySelectorAll('app-sidebar-modal-mini-profile');
    
    modals.forEach(modal => {
        // Check if we already added the text badge
        if (modal.querySelector('.betternow-dev-profile-badge')) return;
        
        // Check if this is a developer's profile - look for avatar URL with developer user ID
        const avatarImg = modal.querySelector('.user-thumb img');
        let isDev = false;
        
        if (avatarImg && avatarImg.src) {
            const match = avatarImg.src.match(/\/(\d+)\/\d+\.jpg/);
            if (match && DEVELOPER_USER_IDS.includes(match[1])) {
                isDev = true;
            }
        }
        
        // Also check by username for backwards compatibility
        const nameEl = modal.querySelector('h3 > p');
        if (nameEl) {
            const profileName = nameEl.textContent.trim();
            if (profileName === myUsername) {
                isDev = true;
            }
        }
        
        if (!isDev) return;
        
        // Add badge to the badge list (same as chat)
        const badgeList = modal.querySelector('user-badges .user-badge ul.badge-list');
        if (badgeList && !badgeList.querySelector('.betternow-dev-badge')) {
            const devBadgeLi = document.createElement('li');
            devBadgeLi.className = 'ng-star-inserted';
            devBadgeLi.style.cssText = 'display: inline-flex; align-items: center;';
            const devBadge = document.createElement('img');
            devBadge.src = 'https://cdn3.emoji.gg/emojis/1564-badge-developer.png';
            devBadge.className = 'betternow-dev-badge special-badges';
            devBadge.alt = 'Developer badge';
            devBadge.style.cssText = 'width: 16px; height: 16px; margin-right: 4px;';
            devBadgeLi.appendChild(devBadge);
            badgeList.appendChild(devBadgeLi);
        }
        
        // Add "BetterNow Developer" text below name/level
        const titleLink = modal.querySelector('a.title');
        if (titleLink) {
            const devText = document.createElement('div');
            devText.className = 'betternow-dev-profile-badge';
            devText.textContent = 'BetterNow Developer';
            devText.style.cssText = `
                font-size: 14px;
                font-weight: 600;
                color: #7289da;
                margin-top: 4px;
                text-align: center;
                width: 100%;
            `;
            // Insert after the title link (below username/level)
            titleLink.parentNode.insertBefore(devText, titleLink.nextSibling);
        }
    });
}

// Observe for profile modals opening
const profileModalObserver = new MutationObserver(() => {
    addDevBadgeToProfileModal();
});

profileModalObserver.observe(document.body, {
    childList: true,
    subtree: true
});
