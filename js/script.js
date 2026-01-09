/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

// Main entry point - initializes all features

// ============ Current User Detection ============

async function detectCurrentUser() {
    const usernameEl = document.querySelector('app-profile-dropdown .username');
    if (!usernameEl || currentUserId) return;

    const username = usernameEl.textContent.trim();
    if (!username) return;

    try {
        const response = await fetch(`https://cdn.younow.com/php/api/channel/getInfo/user=${username}`);
        const data = await response.json();
        if (data.userId) {
            currentUserId = String(data.userId);
        }
    } catch (e) {
        // Silently fail
    }
}

// Detect current user on load and periodically
detectCurrentUser();
setInterval(detectCurrentUser, 5000);

// ============ Initial Setup ============

applyBorders();
hideBroadcasters();
hideCarouselBroadcasters();

// Apply borders after delays to catch late-loading messages
setTimeout(applyBorders, 500);
setTimeout(applyBorders, 1500);
setTimeout(applyBorders, 3000);

// ============ Intervals ============

setInterval(createGridToggle, 1000);
setInterval(applyGridView, 1000);
setInterval(hideCarouselBroadcasters, 200);
setInterval(checkBroadcastStatus, 1000);

// ============ Observers ============

// Watch for video elements to apply fixVideoFit
const videoObserver = new MutationObserver((mutations) => {
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
    hideBroadcasters();
    hideCarouselBroadcasters();
    hideNotifications();
});
broadcasterObserver.observe(document.body, { childList: true, subtree: true });

// Watch for chat messages to apply borders instantly
const chatContainerObserver = new MutationObserver(() => {
    observeChat();
});
chatContainerObserver.observe(document.body, { childList: true, subtree: true });

// Watch for profile popover to add admin button instantly
const popoverObserver = new MutationObserver(() => {
    createAdminPanelEntry();
});
popoverObserver.observe(document.body, { childList: true, subtree: true });