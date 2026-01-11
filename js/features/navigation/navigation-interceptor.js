/*
 * Alex's BetterNow - Navigation Interceptor (Page Context)
 * Intercepts History API to detect SPA navigation
 */

(function() {
    const originalPushState = history.pushState;
    history.pushState = function() {
        originalPushState.apply(this, arguments);
        window.dispatchEvent(new CustomEvent('betternow:navigation'));
    };
    
    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        window.dispatchEvent(new CustomEvent('betternow:navigation'));
    };
})();
