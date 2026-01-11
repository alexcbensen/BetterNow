/*
 * Alex's BetterNow - Filter Bypass Early Injector
 * This runs at document_start to inject the filter bypass before Angular/Zone.js loads
 */

// Only inject if filter bypass is enabled
if (localStorage.getItem('betternow_chatFilterBypass') === 'true') {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('js/filter-bypass.js');
    script.onload = function() {
        this.remove();
    };
    // Inject immediately into the page
    (document.head || document.documentElement).appendChild(script);
    console.log('[BetterNow] Filter bypass injected at document_start');
}
