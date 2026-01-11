/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

// Toolbar features

// ============ BetterNow Toolbar ============

// headerCssEnabled = true means NON-sticky (BetterNow style), false means sticky (YouNow default)
let headerCssEnabled = localStorage.getItem('betternow-sticky-header-disabled') !== 'false';

function createBetterNowToolbar() {
    // Check if toolbar already exists
    if (document.getElementById('betternow-toolbar')) return document.getElementById('betternow-toolbar');
    
    // Find the YouNow top toolbar to insert above
    const youNowToolbar = document.querySelector('app-top-toolbar');
    if (!youNowToolbar) return null;
    
    // Don't show toolbar if not on a live stream
    // broadcaster-is-online class only exists when viewing an active broadcast
    const isLive = document.querySelector('.broadcaster-is-online');
    if (!isLive) return null;
    
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

