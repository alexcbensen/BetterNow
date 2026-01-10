/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

// Grid view and toolbar features

let gridViewEnabled = localStorage.getItem('betternow-grid-view') === 'true';

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