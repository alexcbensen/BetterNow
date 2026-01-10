/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

// Grid view, carousel, and toolbar features

let gridViewEnabled = localStorage.getItem('betternow-grid-view') === 'true';
let lastSkipTime = 0;
let lastDirection = 'next';

// ============ Grid View ============

function getVideoCount() {
    // Only count video tiles that have an active video or audio stream
    return document.querySelectorAll('.fullscreen-wrapper > .video:has(video.is-active), .fullscreen-wrapper > .video:has(.audio.is-active)').length;
}

function createGridToggle() {
    // Grid toggle is now in the BetterNow toolbar
    // This function just applies the grid view state
    applyGridView();
}

function applyGridView() {
    const videoCount = getVideoCount();
    
    // Only apply grid view if enabled AND 2+ videos
    if (gridViewEnabled && videoCount >= 2) {
        document.body.classList.add('grid-view-enabled');
    } else {
        document.body.classList.remove('grid-view-enabled');
    }
}

// Observer placeholder for future grid view adjustments
const audioSmallObserver = new MutationObserver((mutations) => {
    // Currently disabled
});
audioSmallObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

function fixVideoFit() {
    const isGridView = document.body.classList.contains('grid-view-enabled');
    const allVideos = document.querySelectorAll('.video-player video');

    allVideos.forEach(video => {
        const videoTile = video.closest('.video');
        
        if (video.classList.contains('is-screenshare')) {
            // Screenshare: show full content
            video.style.objectFit = 'contain';
        } else {
            // Regular video: fill the frame (may crop edges)
            video.style.objectFit = 'cover';
        }
        
        // Clear any custom aspect ratio
        if (videoTile) {
            videoTile.style.aspectRatio = '';
        }
    });
}

// ============ Carousel / Hidden Broadcasters ============

function hideNotifications() {
    // Hide notifications from hidden users
    hiddenUserIds.forEach(odiskd => {
        // Check if current user is an exception for this specific hidden broadcaster
        const exceptions = hiddenExceptions[odiskd] || {};
        if (currentUserId && exceptions[currentUserId]) {
            return;
        }

        const userData = hiddenUsers[odiskd] || {};
        const username = userData.username;

        if (username) {
            // Find notifications that mention this username
            document.querySelectorAll('.notifications-list app-notification').forEach(notification => {
                const usernameEl = notification.querySelector('.user-card__right b');
                if (usernameEl && usernameEl.textContent.trim().toLowerCase() === username.toLowerCase()) {
                    notification.style.display = 'none';
                }
                
                // Also hide notifications that mention the hidden user in the text
                const textEl = notification.querySelector('.user-card__right');
                if (textEl && textEl.textContent.toLowerCase().includes(username.toLowerCase())) {
                    notification.style.display = 'none';
                }
            });
        }

        // Also hide by avatar URL containing userId
        document.querySelectorAll(`.notifications-list app-notification img.avatar[src*="/${odiskd}/"]`).forEach(img => {
            const notification = img.closest('app-notification');
            if (notification) {
                notification.style.display = 'none';
            }
        });
    });
}

function hideBroadcasters() {
    hiddenUserIds.forEach(odiskd => {
        // Check if current user is an exception for this specific hidden broadcaster
        const exceptions = hiddenExceptions[odiskd] || {};
        if (currentUserId && exceptions[currentUserId]) {
            // Current user is exempt from seeing this hidden broadcaster hidden
            return;
        }

        const userData = hiddenUsers[odiskd] || {};
        const username = userData.username;

        // Hide by username link
        if (username) {
            document.querySelectorAll(`a[href="/${username}"]`).forEach(el => {
                const card = el.closest('li');
                if (card && !card.closest('app-broadcasts-carousel')) {
                    card.style.display = 'none';
                }
            });
        }

        // Hide streams where hidden user is guesting (by their avatar URL containing userId)
        document.querySelectorAll(`app-trending-user-guests img.avatar[src*="/${odiskd}/"]`).forEach(img => {
            const card = img.closest('app-trending-user');
            if (card) {
                const li = card.closest('li');
                if (li && !li.closest('app-broadcasts-carousel')) {
                    li.style.display = 'none';
                }
            }
        });
    });
    
    // Also hide notifications
    hideNotifications();
}

function setupCarouselDirectionTracking() {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (!carousel || carousel.dataset.directionTracked) return;

    const prevBtn = carousel.querySelector('.button--prev');
    const nextBtn = carousel.querySelector('.button--next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            lastDirection = 'prev';
        }, true);
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            lastDirection = 'next';
        }, true);
    }

    carousel.dataset.directionTracked = 'true';
}

function hideCarouselBroadcasters() {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (!carousel) return;

    setupCarouselDirectionTracking();

    const entries = carousel.querySelectorAll('.list__entry');
    const now = Date.now();

    entries.forEach(entry => {
        const isActive = entry.querySelector('button.entry__button[disabled]') !== null;

        if (isActive) {
            const usernameEl = entry.querySelector('h5.username') ||
                entry.querySelector('.toolbar .username span');

            if (usernameEl) {
                const username = usernameEl.textContent.trim();
                // Check if username matches any hidden user (respecting per-broadcaster exceptions)
                const isHidden = hiddenUserIds.some(odiskd => {
                    // Check if current user is an exception for this hidden broadcaster
                    const exceptions = hiddenExceptions[odiskd] || {};
                    if (currentUserId && exceptions[currentUserId]) {
                        return false; // Not hidden for this user
                    }

                    const userData = hiddenUsers[odiskd] || {};
                    return userData.username && userData.username.toLowerCase() === username.toLowerCase();
                });

                if (isHidden) {
                    if (now - lastSkipTime > SKIP_COOLDOWN) {
                        lastSkipTime = now;

                        const btnClass = lastDirection === 'prev' ? '.button--prev' : '.button--next';
                        const skipBtn = carousel.querySelector(btnClass);

                        if (skipBtn) {
                            setTimeout(() => {
                                skipBtn.click();
                            }, 100);
                        }
                    }
                }
            }
        }
    });
}

// ============ BetterNow Toolbar ============

// headerCssEnabled = true means NON-sticky (BetterNow style), false means sticky (YouNow default)
let headerCssEnabled = localStorage.getItem('betternow-sticky-header-disabled') !== 'false';

function createBetterNowToolbar() {
    // Check if toolbar already exists
    if (document.getElementById('betternow-toolbar')) return document.getElementById('betternow-toolbar');
    
    // Find the YouNow top toolbar to insert above
    const youNowToolbar = document.querySelector('app-top-toolbar');
    if (!youNowToolbar) return null;
    
    // Create our toolbar
    const toolbar = document.createElement('div');
    toolbar.id = 'betternow-toolbar';
    toolbar.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px solid var(--main-border-color, #4e4e4e);
    `;
    
    // Create left, middle, and right sections
    const leftSection = document.createElement('div');
    leftSection.className = 'betternow-toolbar__left';
    leftSection.style.cssText = 'display: flex; align-items: center; gap: 12px; flex: 1;';
    
    const middleSection = document.createElement('div');
    middleSection.className = 'betternow-toolbar__middle';
    middleSection.style.cssText = 'display: flex; align-items: center; justify-content: center;';
    
    const rightSection = document.createElement('div');
    rightSection.className = 'betternow-toolbar__right';
    rightSection.style.cssText = 'display: flex; align-items: center; gap: 12px; flex: 1; justify-content: flex-end;';
    
    // Add CSS toggle button to left section for testing
    const cssToggle = document.createElement('button');
    cssToggle.id = 'betternow-css-toggle';
    cssToggle.textContent = 'STICKY HEADER';
    cssToggle.style.cssText = `
        background: ${headerCssEnabled ? 'var(--color-mediumgray, #888)' : 'var(--color-primary-green, #08d687)'};
        border: none;
        color: var(--color-white, #fff);
        padding: 0.35em 0.5em 0.2em 0.68em;
        border-radius: 0.4em;
        font-size: 0.7em;
        font-weight: 600;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        cursor: pointer;
        font-family: inherit;
    `;
    
    // Apply initial header state
    const header = document.querySelector('app-channel .header');
    if (header) {
        if (headerCssEnabled) {
            header.style.setProperty('position', 'relative', 'important');
            header.style.setProperty('top', '0', 'important');
        } else {
            header.style.setProperty('position', 'sticky', 'important');
            header.style.setProperty('top', 'var(--topbar-height)', 'important');
        }
        header.style.setProperty('border-bottom', 'none', 'important');
        header.style.setProperty('border-color', 'transparent', 'important');
    }
    
    cssToggle.onclick = () => {
        headerCssEnabled = !headerCssEnabled;
        localStorage.setItem('betternow-sticky-header-disabled', headerCssEnabled.toString());
        const header = document.querySelector('app-channel .header');
        if (header) {
            if (headerCssEnabled) {
                // BetterNow style: scrolls with page, no border
                header.style.setProperty('position', 'relative', 'important');
                header.style.setProperty('top', '0', 'important');
                header.style.setProperty('border-bottom', 'none', 'important');
                header.style.setProperty('border-color', 'transparent', 'important');
                cssToggle.style.background = 'var(--color-mediumgray, #888)';
            } else {
                // Default YouNow style: sticky header with border
                header.style.setProperty('position', 'sticky', 'important');
                header.style.setProperty('top', 'var(--topbar-height)', 'important');
                header.style.setProperty('border-bottom', 'none', 'important');
                header.style.setProperty('border-color', 'transparent', 'important');
                cssToggle.style.background = 'var(--color-primary-green, #08d687)';
            }
        }
    };
    leftSection.appendChild(cssToggle);
    
    // Add Grid View toggle button
    const gridToggle = document.createElement('button');
    gridToggle.id = 'grid-toggle-btn';
    gridToggle.textContent = 'GRID VIEW';
    gridToggle.style.cssText = `
        background: ${gridViewEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-mediumgray, #888)'};
        border: none;
        color: var(--color-white, #fff);
        padding: 0.35em 0.5em 0.2em 0.68em;
        border-radius: 0.4em;
        font-size: 0.7em;
        font-weight: 600;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        cursor: pointer;
        font-family: inherit;
    `;
    gridToggle.onclick = () => {
        gridViewEnabled = !gridViewEnabled;
        localStorage.setItem('betternow-grid-view', gridViewEnabled.toString());
        gridToggle.style.background = gridViewEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-mediumgray, #888)';
        applyGridView();
    };
    leftSection.appendChild(gridToggle);
    
    // Apply initial grid view state
    applyGridView();
    
    toolbar.appendChild(leftSection);
    toolbar.appendChild(middleSection);
    toolbar.appendChild(rightSection);
    
    // Insert above YouNow toolbar
    youNowToolbar.parentNode.insertBefore(toolbar, youNowToolbar);
    
    // Try to create admin bar (async, for admin users only)
    if (typeof createAdminBar === 'function') {
        createAdminBar();
    }
    
    return toolbar;
}

// ============ Profile Modal Developer Badge ============

function addDevBadgeToProfileModal() {
    // Find profile modals
    const modals = document.querySelectorAll('app-sidebar-modal-mini-profile');
    
    modals.forEach(modal => {
        // Check if we already added the text badge
        if (modal.querySelector('.betternow-dev-profile-badge')) return;
        
        // Check if this is Alex's profile - the name is in h3 > p
        const nameEl = modal.querySelector('h3 > p');
        if (!nameEl) return;
        
        const profileName = nameEl.textContent.trim();
        if (profileName !== myUsername) return;
        
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