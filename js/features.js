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

// Debug logging - set to false for production
const FEATURES_DEBUG = false;

function featuresLog(...args) {
    if (FEATURES_DEBUG) {
        console.log('[BetterNow]', ...args);
    }
}

function isOnLiveBroadcast() {
    // Fast live broadcast detection for toolbar creation

    // If offline element exists, definitely not a live broadcast
    const isOffline = document.querySelector('app-video-player-broadcaster-offline') !== null;
    featuresLog('isOnLiveBroadcast check: app-video-player-broadcaster-offline =', isOffline);
    if (isOffline) return false;

    // Must have broadcaster-is-online class (indicates live stream)
    const isLive = document.querySelector('.broadcaster-is-online') !== null;
    featuresLog('isOnLiveBroadcast check: .broadcaster-is-online =', isLive);
    if (!isLive) return false;

    // Must have app-top-toolbar (where we insert our toolbar)
    const hasToolbar = document.querySelector('app-top-toolbar') !== null;
    featuresLog('isOnLiveBroadcast check: app-top-toolbar =', hasToolbar);
    if (!hasToolbar) return false;

    // Must have video-player that is NOT inside a carousel
    const videoPlayer = document.querySelector('.video-player:not(app-broadcasts-carousel .video-player)');
    featuresLog('isOnLiveBroadcast check: video-player =', videoPlayer);
    if (!videoPlayer) return false;

    featuresLog('isOnLiveBroadcast: ALL CHECKS PASSED - showing toolbar');
    return true;
}

// Export for other modules
window.isOnLiveBroadcast = isOnLiveBroadcast;

// ============ BetterNow Toolbar ============

// headerCssEnabled = true means NON-sticky (BetterNow style), false means sticky (YouNow default)
let headerCssEnabled = localStorage.getItem('betternow-sticky-header-disabled') !== 'false';

// Track if toolbar features have been initialized
let toolbarFeaturesInitialized = false;

function createBetterNowToolbar() {
    // Don't create toolbar if extension is disabled for blocked users
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) return null;

    // Check if we're on a live broadcast
    const onLiveBroadcast = isOnLiveBroadcast();

    // If toolbar already exists
    const existingToolbar = document.getElementById('betternow-toolbar');
    if (existingToolbar) {
        // Remove it if we're no longer on a live broadcast
        if (!onLiveBroadcast) {
            featuresLog('Removing toolbar - no longer on live broadcast');
            existingToolbar.remove();
            return null;
        }
        return existingToolbar;
    }

    // Don't create toolbar if not on a live broadcast
    if (!onLiveBroadcast) return null;

    // Find the YouNow top toolbar to insert above
    const youNowToolbar = document.querySelector('app-top-toolbar');
    if (!youNowToolbar) return null;

    featuresLog('Creating toolbar - on live broadcast');

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
    // Read grid view state - use typeof check in case grid.js hasn't loaded yet
    const isGridEnabled = typeof gridViewEnabled !== 'undefined' ? gridViewEnabled : localStorage.getItem('betternow-grid-view') === 'true';
    gridToggle.style.cssText = BETTERNOW_BUTTON_STYLE + `
        background: ${isGridEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-mediumgray, #888)'};
    `;
    gridToggle.onclick = () => {
        // Toggle the global variable (setter writes to localStorage automatically)
        if (typeof gridViewEnabled !== 'undefined') {
            gridViewEnabled = !gridViewEnabled;
            gridToggle.style.background = gridViewEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-mediumgray, #888)';
        } else {
            // Fallback if grid.js hasn't loaded
            const newState = localStorage.getItem('betternow-grid-view') !== 'true';
            localStorage.setItem('betternow-grid-view', newState.toString());
            gridToggle.style.background = newState ? 'var(--color-primary-green, #08d687)' : 'var(--color-mediumgray, #888)';
        }
        if (typeof applyGridView === 'function') applyGridView();
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

    // Initialize all toolbar features (all scripts are loaded at this point)
    initToolbarFeatures();

    return toolbar;
}

// Initialize all toolbar features - called after toolbar is created
let toolbarFeaturesRetryCount = 0;
const MAX_TOOLBAR_RETRIES = 20; // 10 seconds max

function initToolbarFeatures() {
    // Don't init if extension is disabled for blocked users
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) return;

    if (toolbarFeaturesInitialized) return;

    toolbarFeaturesRetryCount++;

    // Create chest controls immediately if broadcasting (doesn't need currentUserId)
    if (typeof createChestControls === 'function' && typeof isBroadcasting === 'function' && isBroadcasting()) {
        createChestControls();
    }

    // For filter bypass and missions, we need currentUserId
    if (typeof currentUserId === 'undefined' || !currentUserId) {
        if (toolbarFeaturesRetryCount < MAX_TOOLBAR_RETRIES) {
            setTimeout(initToolbarFeatures, 500);
            return;
        } else {
            console.warn('[BetterNow] initToolbarFeatures: Max retries reached, currentUserId still null');
            toolbarFeaturesInitialized = true;
            return;
        }
    }

    toolbarFeaturesInitialized = true;

    // Create filter bypass button if user has access
    if (typeof createFilterBypassButton === 'function') {
        createFilterBypassButton();
    }

    // Create missions button if available
    if (typeof createMissionsAutoClaimButton === 'function') {
        createMissionsAutoClaimButton();
    }
}

// Reset toolbar features flag when toolbar is removed
function resetToolbarFeatures() {
    toolbarFeaturesInitialized = false;
}

// Remove toolbar when navigating away from live broadcast
function removeBetterNowToolbar() {
    const toolbar = document.getElementById('betternow-toolbar');
    if (toolbar) {
        toolbar.remove();
        resetToolbarFeatures();
    }
}

// NOTE: Toolbar initialization is triggered from script.js after all scripts are loaded