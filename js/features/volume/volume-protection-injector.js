/*
 * Alex's BetterNow - Volume Protection Injector
 *
 * This runs at document_start to inject volume-protection.js into the page context
 * BEFORE YouNow's Zone.js can capture the original HTMLMediaElement.prototype references.
 */

(function() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('js/features/volume/volume-protection.js');
    script.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
})();