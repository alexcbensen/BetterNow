// ============ Hide Ads Feature ============
// Grantable feature to hide promotional elements

function injectHideAdsStyles() {
    if (document.getElementById('betternow-hide-ads-styles')) return;

    const style = document.createElement('style');
    style.id = 'betternow-hide-ads-styles';
    style.textContent = `
        /* Hide "Sale Day Is Live!" button */
        .sale-button-wrapper,
        .button--sale-event {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}

function removeHideAdsStyles() {
    const style = document.getElementById('betternow-hide-ads-styles');
    if (style) style.remove();
}

// Initialize hide ads if user has access
function initHideAds() {
    // Don't init if extension is disabled
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) return;

    // Check if user has the hideAds feature
    if (typeof userHasFeature === 'function' && userHasFeature('hideAds')) {
        injectHideAdsStyles();
    }
}

// Wait for settings to load before initializing
function waitForSettingsThenInitHideAds() {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max

    const checkInterval = setInterval(() => {
        attempts++;

        // If extension is disabled, stop
        if (typeof extensionDisabled !== 'undefined' && extensionDisabled) {
            clearInterval(checkInterval);
            return;
        }

        // If settings loaded, init hide ads
        if (typeof settingsLoaded !== 'undefined' && settingsLoaded) {
            clearInterval(checkInterval);
            initHideAds();
            return;
        }

        // Timeout - try anyway
        if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            if (typeof extensionDisabled === 'undefined' || !extensionDisabled) {
                initHideAds();
            }
        }
    }, 100);
}

// Start waiting for settings
waitForSettingsThenInitHideAds();