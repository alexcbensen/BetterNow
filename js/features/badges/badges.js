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
                color: #dce2f6;
                text-shadow: 0 0 3px #7289da, 0 0 6px #7289da;
                margin-top: 4px;
                text-align: center;
                width: 100%;
            `;
            // Insert after the title link (below username/level)
            titleLink.parentNode.insertBefore(devText, titleLink.nextSibling);
        }
    });
}

// Add "BetterNow User" text to profile modals for online BetterNow users
function addUserBadgeToProfileModal() {
    // Find profile modals
    const modals = document.querySelectorAll('app-sidebar-modal-mini-profile');

    modals.forEach(modal => {
        // Skip if already has developer or user badge text
        if (modal.querySelector('.betternow-dev-profile-badge')) return;
        if (modal.querySelector('.betternow-user-profile-badge')) return;

        // Get user ID from avatar URL
        const avatarImg = modal.querySelector('.user-thumb img');
        let userId = null;

        if (avatarImg && avatarImg.src) {
            const match = avatarImg.src.match(/\/(\d+)\/\d+\.jpg/);
            if (match) {
                userId = match[1];
            }
        }

        if (!userId) return;

        // Skip developers (they get developer badge)
        if (typeof DEVELOPER_USER_IDS !== 'undefined' && DEVELOPER_USER_IDS.includes(userId)) return;
        if (typeof ADMIN_USER_IDS !== 'undefined' && ADMIN_USER_IDS.includes(userId)) return;

        // Check if user is online with BetterNow
        let isOnline = false;
        if (typeof window.onlineBetterNowUserIds !== 'undefined' && window.onlineBetterNowUserIds instanceof Set) {
            isOnline = window.onlineBetterNowUserIds.has(userId);
        }

        if (!isOnline) return;

        // Add LIT badge to the badge list
        let badgeList = modal.querySelector('user-badges .user-badge ul.badge-list');

        // Create badge structure if it doesn't exist
        if (!badgeList) {
            const badgeContainer = modal.querySelector('.user-thumb')?.parentElement || modal.querySelector('a.title')?.parentElement;
            if (badgeContainer) {
                // Try to find where to insert badges
                const userBadgesEl = modal.querySelector('user-badges');
                if (userBadgesEl) {
                    let userBadgeDiv = userBadgesEl.querySelector('.user-badge');
                    if (!userBadgeDiv) {
                        userBadgeDiv = document.createElement('div');
                        userBadgeDiv.className = 'user-badge is-small';
                        userBadgesEl.appendChild(userBadgeDiv);
                    }
                    badgeList = userBadgeDiv.querySelector('ul.badge-list');
                    if (!badgeList) {
                        badgeList = document.createElement('ul');
                        badgeList.className = 'badge-list ng-star-inserted';
                        userBadgeDiv.appendChild(badgeList);
                    }
                }
            }
        }

        // Add LIT badge if we have a badge list
        if (badgeList && !badgeList.querySelector('.betternow-user-badge')) {
            const badgeLi = document.createElement('li');
            badgeLi.className = 'ng-star-inserted';
            badgeLi.style.cssText = 'display: inline-flex; align-items: center;';
            const badge = document.createElement('img');

            // Use custom badge URL from settings, or default to local asset
            if (typeof betternowUserStyle !== 'undefined' && betternowUserStyle.badgeUrl) {
                badge.src = betternowUserStyle.badgeUrl;
            } else if (typeof BETTERNOW_USER_BADGE_URL !== 'undefined') {
                badge.src = BETTERNOW_USER_BADGE_URL;
            } else {
                badge.src = chrome.runtime.getURL('assets/badges/verified.svg');
            }

            badge.className = 'betternow-user-badge special-badges';
            badge.alt = 'BetterNow User';
            badge.title = 'BetterNow User';
            badge.style.cssText = 'width: 16px; height: 16px; margin-right: 4px;';
            badgeLi.appendChild(badge);
            badgeList.appendChild(badgeLi);
        }

        // Add "BetterNow User" text below name/level
        const titleLink = modal.querySelector('a.title');
        if (titleLink) {
            // Get custom colors from settings, or use defaults
            const textColor = (typeof betternowUserStyle !== 'undefined' && betternowUserStyle.textColor)
                ? betternowUserStyle.textColor
                : '#e0c2f3';
            const glowColor = (typeof betternowUserStyle !== 'undefined' && betternowUserStyle.glowColor)
                ? betternowUserStyle.glowColor
                : '#820ad0';
            const glowIntensity = (typeof betternowUserStyle !== 'undefined' && typeof betternowUserStyle.glowIntensity === 'number')
                ? betternowUserStyle.glowIntensity
                : 6;
            const glowOpacity = (typeof betternowUserStyle !== 'undefined' && typeof betternowUserStyle.glowOpacity === 'number')
                ? betternowUserStyle.glowOpacity / 100
                : 1;
            const halfIntensity = Math.round(glowIntensity / 2);

            // Convert hex to rgba for opacity support
            const hexToRgba = (hex, alpha) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            };

            let textShadow = 'none';
            if (glowIntensity > 0 && glowOpacity > 0) {
                const glowColorWithOpacity = hexToRgba(glowColor, glowOpacity);
                textShadow = `0 0 ${halfIntensity}px ${glowColorWithOpacity}, 0 0 ${glowIntensity}px ${glowColorWithOpacity}`;
            }

            const userText = document.createElement('div');
            userText.className = 'betternow-user-profile-badge';
            userText.textContent = 'BetterNow User';
            userText.style.cssText = `
                font-size: 14px;
                font-weight: 600;
                color: ${textColor};
                text-shadow: ${textShadow};
                margin-top: 4px;
                text-align: center;
                width: 100%;
            `;
            // Insert after the title link (below username/level)
            titleLink.parentNode.insertBefore(userText, titleLink.nextSibling);
        }
    });
}

// Observe for profile modals opening
const profileModalObserver = new MutationObserver(() => {
    addDevBadgeToProfileModal();
    addUserBadgeToProfileModal();
});

profileModalObserver.observe(document.body, {
    childList: true,
    subtree: true
});