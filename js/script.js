// Main entry point - initializes all features

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
setInterval(fixVideoFit, 1000);
setInterval(hideCarouselBroadcasters, 200);
setInterval(checkBroadcastStatus, 1000);

// ============ Observers ============

// Watch for DOM changes to hide broadcasters
const broadcasterObserver = new MutationObserver(() => {
    hideBroadcasters();
    hideCarouselBroadcasters();
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