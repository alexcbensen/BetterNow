/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

// Toolbar features

// ============ Shared Button Style ============
// Used by all BetterNow toolbar buttons for consistent styling
const BETTERNOW_BUTTON_STYLE = `
    border: none;
    color: var(--color-white, #fff);
    padding: 0.35em 0.7em;
    border-radius: 0.4em;
    font-size: 0.7em;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
`;

// Export for other modules
window.BETTERNOW_BUTTON_STYLE = BETTERNOW_BUTTON_STYLE;

// ============ Live Broadcast Detection ============

function isOnLiveBroadcast() {
    // Robust live broadcast detection
    // A page is a live broadcast ONLY if:
    // 1. There's a video-player that is NOT inside a carousel
    // 2. Has broadcaster-is-online class
    // 3. Video has actual content

    // Must have broadcaster-is-online class
    const isLive = document.querySelector('.broadcaster-is-online') !== null;
    if (!isLive) return false;

    // Find video-player that is NOT inside a carousel
    // The carousel contains its own video-player for previews
    const videoPlayer = document.querySelector('.video-player:not(app-broadcasts-carousel .video-player)');
    if (!videoPlayer) return false;

    // Must have actual video element with source/playing
    const video = videoPlayer.querySelector('video');
    if (!video) return false;

    // Check if video has actual content (not just an empty element)
    const hasVideoContent = video.readyState > 0 || video.src || video.srcObject;
    if (!hasVideoContent) return false;

    // Must have fullscreen-wrapper NOT inside carousel
    const hasFullscreenWrapper = document.querySelector('.fullscreen-wrapper:not(app-broadcasts-carousel .fullscreen-wrapper)') !== null;

    return hasFullscreenWrapper;
}

// Export for other modules
window.isOnLiveBroadcast = isOnLiveBroadcast;

// ============ BetterNow Toolbar ============

// headerCssEnabled = true means NON-sticky (BetterNow style), false means sticky (YouNow default)
let headerCssEnabled = localStorage.getItem('betternow-sticky-header-disabled') !== 'false';

function createBetterNowToolbar() {
    // Check if toolbar already exists
    if (document.getElementById('betternow-toolbar')) return document.getElementById('betternow-toolbar');

    // Find the YouNow top toolbar to insert above
    const youNowToolbar = document.querySelector('app-top-toolbar');
    if (!youNowToolbar) return null;

    // Don't show toolbar if not on a live broadcast
    if (!isOnLiveBroadcast()) return null;

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
    leftSection.style.cssText = 'display: flex; align-items: center; gap: 12px; flex: 1; flex-wrap: nowrap;';

    const middleSection = document.createElement('div');
    middleSection.className = 'betternow-toolbar__middle';
    middleSection.style.cssText = 'display: flex; align-items: center; justify-content: center;';

    const rightSection = document.createElement('div');
    rightSection.className = 'betternow-toolbar__right';
    rightSection.style.cssText = 'display: flex; align-items: center; gap: 12px; flex: 0; justify-content: flex-end;';

    // Add CSS toggle button to left section for testing
    const cssToggle = document.createElement('button');
    cssToggle.id = 'betternow-css-toggle';
    cssToggle.textContent = 'STICKY HEADER';
    cssToggle.style.cssText = BETTERNOW_BUTTON_STYLE + `
        background: ${headerCssEnabled ? 'var(--color-mediumgray, #888)' : 'var(--color-primary-green, #08d687)'};
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
    gridToggle.style.cssText = BETTERNOW_BUTTON_STYLE + `
        background: ${gridViewEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-mediumgray, #888)'};
    `;
    gridToggle.onclick = () => {
        gridViewEnabled = !gridViewEnabled;
        localStorage.setItem('betternow-grid-view', gridViewEnabled.toString());
        gridToggle.style.background = gridViewEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-mediumgray, #888)';
        applyGridView();
    };
    leftSection.appendChild(gridToggle);

    // Add invisible marker for button ordering - AUTO CHEST goes after this
    const chestMarker = document.createElement('span');
    chestMarker.id = 'betternow-chest-marker';
    chestMarker.style.display = 'none';
    leftSection.appendChild(chestMarker);

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

// Remove toolbar when navigating away from live broadcast
function removeBetterNowToolbar() {
    const toolbar = document.getElementById('betternow-toolbar');
    if (toolbar) {
        toolbar.remove();
    }
}