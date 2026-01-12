/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

// Main entry point - initializes all features

// ============ Blocked User Check ============

let extensionDisabled = false;

function isCurrentUserBlocked() {
    // Check if the logged-in user is in the hidden broadcasters list
    if (!currentUserId) return false;

    // Check by userId
    if (hiddenUserIds.includes(currentUserId) || hiddenUserIds.includes(String(currentUserId))) {
        return true;
    }

    return false;
}

// ============ Current User Detection ============

async function detectCurrentUser() {
    // Skip if already detected
    if (currentUserId) return;

    // Method 1: Try to decode from nft cookie (base64 encoded userId)
    const nftMatch = document.cookie.match(/nft=([^;]+)/);
    if (nftMatch) {
        try {
            const decoded = atob(decodeURIComponent(nftMatch[1]));
            if (/^\d+$/.test(decoded)) {
                currentUserId = decoded;
                return;
            }
        } catch (e) {}
    }

    // Method 2: Check performance API for userId in requests
    const entries = performance.getEntriesByType('resource');
    for (const entry of entries) {
        if (entry.name && entry.name.includes('userId=')) {
            const match = entry.name.match(/userId=(\d+)/);
            if (match) {
                currentUserId = match[1];
                return;
            }
        }
    }

    // Method 3: Try from username in profile dropdown (original method)
    const usernameEl = document.querySelector('app-profile-dropdown .username');
    if (usernameEl) {
        const username = usernameEl.textContent.trim();
        if (username) {
            try {
                const response = await fetch(`https://cdn.younow.com/php/api/channel/getInfo/user=${username}`);
                const data = await response.json();
                if (data.userId) {
                    currentUserId = String(data.userId);
                    return;
                }
            } catch (e) {
                // Silently fail
            }
        }
    }
}

// Detect current user on load and periodically
detectCurrentUser();
setInterval(detectCurrentUser, 5000);

// ============ Initial Setup ============

// Flag to indicate blocked user check is complete
let blockedCheckComplete = false;

// Wait for user to be logged in and Firebase data to load
let initAttempts = 0;
const initInterval = setInterval(() => {
    initAttempts++;

    // Don't initialize if not logged in
    if (!currentUserId) {
        if (initAttempts > 40) {
            // Stop checking after ~20 seconds if not logged in
            clearInterval(initInterval);
            blockedCheckComplete = true; // Mark complete even on timeout
        }
        return;
    }

    // Wait for Firebase settings to load before checking blocked status
    // This prevents race condition where user initializes before hiddenUserIds loads
    if (!settingsLoaded) {
        if (initAttempts > 40) {
            // Timeout - proceed without Firebase (fail open)
            console.warn('[BetterNow] Firebase settings not loaded after 20s, proceeding anyway');
        } else {
            return; // Keep waiting
        }
    }

    // Store current user ID and blocked list in localStorage for injector.js
    // (injector.js runs at document_start before we can check Firebase)
    localStorage.setItem('betternow_currentUserId', currentUserId);
    localStorage.setItem('betternow_blockedUserIds', JSON.stringify(hiddenUserIds));

    // Check if user is blocked
    if (isCurrentUserBlocked()) {
        extensionDisabled = true;
        blockedCheckComplete = true;
        clearInterval(initInterval);

        // Re-enable carousel that was hidden by styles.css
        // Inject CSS to override the hide rule
        const overrideStyle = document.createElement('style');
        overrideStyle.id = 'betternow-blocked-override';
        overrideStyle.textContent = `
            app-broadcasts-carousel:not(.betternow-ready) {
                visibility: visible !important;
            }
        `;
        document.head.appendChild(overrideStyle);

        return; // Don't initialize anything
    }

    // User is logged in and not blocked - initialize
    blockedCheckComplete = true;
    clearInterval(initInterval);
    initializeExtension();
}, 500);

function initializeExtension() {
    if (extensionDisabled) return;

    // NOTE: applyChatStyles is NOT called here because presence won't be ready yet
    // The active-users.js module will call it after fetching online users

    hideBroadcasters();
    hideCarouselBroadcasters();

    // REMOVED: Multiple delayed applyChatStyles calls
    // The chat observer with throttling handles updates now

    // ============ Observers ============

    // Watch for video elements to apply fixVideoFit
    const videoObserver = new MutationObserver((mutations) => {
        if (extensionDisabled) return;
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                const hasVideoChanges = mutation.addedNodes.length > 0 &&
                    Array.from(mutation.addedNodes).some(node =>
                        node.nodeType === 1 && (node.tagName === 'VIDEO' || node.querySelector?.('video'))
                    );
                if (hasVideoChanges) {
                    fixVideoFit();
                    break;
                }
            }
            if (mutation.type === 'attributes' && mutation.target.tagName === 'VIDEO') {
                fixVideoFit();
                break;
            }
        }
    });
    videoObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });

    // Run once on load
    fixVideoFit();

    // Watch for DOM changes to hide broadcasters and notifications
    const broadcasterObserver = new MutationObserver(() => {
        if (extensionDisabled) return;
        hideBroadcasters();
        hideCarouselBroadcasters();
        hideNotifications();
    });
    broadcasterObserver.observe(document.body, { childList: true, subtree: true });

    // Watch for chat messages to apply styles instantly
    const chatContainerObserver = new MutationObserver(() => {
        if (extensionDisabled) return;
        observeChat();
        if (typeof observeAudience === 'function') {
            observeAudience();
        }
    });
    chatContainerObserver.observe(document.body, { childList: true, subtree: true });

    // Watch for profile popover to add admin button instantly
    const popoverObserver = new MutationObserver(() => {
        if (extensionDisabled) return;
        createAdminPanelEntry();
    });
    popoverObserver.observe(document.body, { childList: true, subtree: true });

    // Watch for grid toggle button container and video count changes
    const gridObserver = new MutationObserver((mutations) => {
        if (extensionDisabled) return;
        // Check if toolbar or video tiles changed
        const shouldUpdate = mutations.some(mutation => {
            if (mutation.type === 'childList') {
                const target = mutation.target;
                return target.matches?.('.top-button-wrapper, .fullscreen-wrapper') ||
                    target.closest?.('.top-button-wrapper, .fullscreen-wrapper') ||
                    Array.from(mutation.addedNodes).some(node =>
                            node.nodeType === 1 && (
                                node.matches?.('.top-button-wrapper, .fullscreen-wrapper, .video') ||
                                node.querySelector?.('.top-button-wrapper, .fullscreen-wrapper, .video')
                            )
                    ) ||
                    Array.from(mutation.removedNodes).some(node =>
                        node.nodeType === 1 && node.matches?.('.video')
                    );
            }
            return false;
        });

        if (shouldUpdate) {
            createGridToggle();
            applyGridView();
        }
    });
    gridObserver.observe(document.body, { childList: true, subtree: true });

    // Run once on load
    createGridToggle();
    applyGridView();

    // Watch for broadcast status changes (END button appearing/disappearing)
    const broadcastObserver = new MutationObserver((mutations) => {
        if (extensionDisabled) return;
        const shouldCheck = mutations.some(mutation => {
            if (mutation.type === 'childList') {
                return Array.from(mutation.addedNodes).some(node =>
                        node.nodeType === 1 && (
                            node.matches?.('.toolbar, .button--red, .chest-button') ||
                            node.querySelector?.('.toolbar, .button--red, .chest-button')
                        )
                ) || Array.from(mutation.removedNodes).some(node =>
                        node.nodeType === 1 && (
                            node.matches?.('.button--red, .chest-button') ||
                            node.querySelector?.('.button--red, .chest-button')
                        )
                );
            }
            return false;
        });

        if (shouldCheck) {
            setTimeout(checkBroadcastStatus, 500);
        }
    });
    broadcastObserver.observe(document.body, { childList: true, subtree: true });

    // Run once on load
    checkBroadcastStatus();

    // Also run after a short delay to catch late-loading elements
    setTimeout(checkBroadcastStatus, 1000);
}

// ============ BetterNow Toolbar Initialization ============
// This runs AFTER all scripts are loaded, so all functions are available
// Must wait for blocked user check before creating toolbar

let toolbarObserver = null;

function initBetterNowToolbar() {
    // Don't create toolbar if extension is disabled
    if (extensionDisabled) return;

    // Try to create toolbar immediately
    if (isOnLiveBroadcast()) {
        createBetterNowToolbar();
    }

    // Also watch for navigation/DOM changes to create toolbar when needed
    toolbarObserver = new MutationObserver((mutations) => {
        // Skip if extension disabled or toolbar already exists
        if (extensionDisabled || document.getElementById('betternow-toolbar')) return;

        // Check for relevant changes
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches?.('app-top-toolbar, .broadcaster-is-online, .video-player') ||
                            node.querySelector?.('app-top-toolbar, .broadcaster-is-online, .video-player')) {
                            if (isOnLiveBroadcast()) {
                                createBetterNowToolbar();
                            }
                            return;
                        }
                    }
                }
            }
        }
    });

    toolbarObserver.observe(document.body, { childList: true, subtree: true });
}

// Wait for blocked user check before initializing toolbar
function waitForBlockedCheckThenInitToolbar() {
    // Check every 100ms until we know if user is blocked or not
    const checkInterval = setInterval(() => {
        // If extension is disabled (user is blocked), stop and don't init
        if (extensionDisabled) {
            clearInterval(checkInterval);
            console.log('[BetterNow] Toolbar disabled for blocked user');
            return;
        }

        // If settingsLoaded and currentUserId exist, blocked check is complete
        if (settingsLoaded && currentUserId) {
            clearInterval(checkInterval);
            initBetterNowToolbar();
        }
    }, 100);

    // Timeout after 25 seconds (longer than the init interval timeout)
    setTimeout(() => {
        clearInterval(checkInterval);
        // Only init if not disabled
        if (!extensionDisabled) {
            initBetterNowToolbar();
        }
    }, 25000);
}

// Start waiting for blocked check
waitForBlockedCheckThenInitToolbar();