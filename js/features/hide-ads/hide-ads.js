// ============ Hide Ads Feature ============
// Grantable feature to hide promotional elements

function injectHideAdsStyles() {
    if (document.getElementById('betternow-hide-ads-styles')) return;

    const style = document.createElement('style');
    style.id = 'betternow-hide-ads-styles';
    style.textContent = `
        /* Hide sale/discount/promo buttons and wrappers */
        .sale-button-wrapper,
        .button--sale-event,
        .promo-wrapper,
        [class*="sale-"],
        [class*="-sale"],
        [class*="discount"],
        [class*="promo-"] {
            display: none !important;
        }
        
        /* Hide sale/discount/bar related Angular components */
        [class*="sale-bar"],
        app-sale-bar,
        app-sale-bar-discount-event-content,
        [class*="discount-event"] {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}

// Also hide elements dynamically in case they're added after styles
function hidePromoElements() {
    // Keywords to look for in tag names and class names
    const keywords = ['sale', 'discount', 'promo'];

    // Find and hide custom elements (Angular components) with these keywords
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        const tagName = el.tagName.toLowerCase();
        const className = el.className?.toString?.().toLowerCase() || '';

        for (const keyword of keywords) {
            if (tagName.includes(keyword) || className.includes(keyword)) {
                if (el.style.display !== 'none') {
                    el.style.display = 'none';
                }
                break;
            }
        }
    });
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

        // Run once immediately
        hidePromoElements();

        // Set up observer to catch dynamically added promo elements
        const observer = new MutationObserver(() => {
            hidePromoElements();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
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