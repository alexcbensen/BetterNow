// ============ Chat Styling ============
// Friend borders, dev badges, light mode fixes, username coloring

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

function applyBorders() {
    
    // Apply borders for my username
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
                // Always use the configured text color
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
                        width: calc(100% + 6px);
                        height: calc(100% + 6px);
                        pointer-events: none;
                        z-index: 1;
                    `;
                    avatarThumb.style.position = 'relative';
                    avatarThumb.appendChild(borderImg);
                }
            }

            // Add developer badge
            const userBadgeDiv = li.querySelector('user-badges .user-badge');
            if (userBadgeDiv) {
                const existingDevBadge = userBadgeDiv.querySelector('.betternow-dev-badge');
                if (!existingDevBadge) {
                    // Find the badge list (ul) that contains special badges
                    const badgeList = userBadgeDiv.querySelector('ul.badge-list');
                    if (badgeList) {
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
                }
            }
        }
    });

    // Apply borders for friend usernames
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
                        // Always use the configured text color
                        usernameSpan.style.setProperty('color', settings.textColor, 'important');
                    }
                }

                // Apply level background if enabled
                if (settings.levelEnabled && settings.levelColor1) {
                    const levelBadge = li.querySelector('app-user-level .user-level');
                    if (levelBadge) {
                        // Use gradient if two colors provided, otherwise solid color
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
}

function observeChat() {
    const chatContainer = document.querySelector('app-chat-list');
    if (chatContainer && !chatContainer.hasAttribute('data-observing')) {
        const chatObserver = new MutationObserver(() => {
            applyBorders();
        });
        chatObserver.observe(chatContainer, { childList: true, subtree: true });
        chatContainer.setAttribute('data-observing', 'true');
    }
}
