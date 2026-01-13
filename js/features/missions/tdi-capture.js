/*
 * Alex's BetterNow - TDI Capture (Page Context)
 * Intercepts XHR/fetch to capture TDI token from mission claims
 */

(function() {
    // Prevent double injection
    if (window.__betternowTdiCaptureInjected) return;
    window.__betternowTdiCaptureInjected = true;

    console.log('[BetterNow TDI] Page context script loaded');

    // Intercept XMLHttpRequest
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalXHROpen = XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._betternowUrl = url;
        this._betternowMethod = method;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(data) {
        // Check for mission claim requests
        if (data && typeof data === 'string' &&
            this._betternowUrl?.includes('userMissions/claim') &&
            data.includes('tdi=')) {
            try {
                const params = new URLSearchParams(data);
                const tdi = params.get('tdi');
                if (tdi) {
                    console.log('[BetterNow TDI] Captured TDI from XHR:', tdi.substring(0, 20) + '...');
                    // Send TDI to content script via postMessage
                    window.postMessage({ 
                        type: 'BETTERNOW_TDI_CAPTURED', 
                        tdi: tdi 
                    }, '*');
                }
            } catch (e) {
                console.error('[BetterNow TDI] XHR capture error:', e);
            }
        }
        return originalXHRSend.call(this, data);
    };

    // Also intercept fetch in case YouNow uses it
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        if (options && options.method && options.method.toUpperCase() === 'POST' && 
            options.body && typeof options.body === 'string' &&
            typeof url === 'string' && url.includes('userMissions/claim') &&
            options.body.includes('tdi=')) {
            try {
                const params = new URLSearchParams(options.body);
                const tdi = params.get('tdi');
                if (tdi) {
                    console.log('[BetterNow TDI] Captured TDI from fetch:', tdi.substring(0, 20) + '...');
                    window.postMessage({ 
                        type: 'BETTERNOW_TDI_CAPTURED', 
                        tdi: tdi 
                    }, '*');
                }
            } catch (e) {
                console.error('[BetterNow TDI] Fetch capture error:', e);
            }
        }
        return originalFetch.call(this, url, options);
    };

    console.log('[BetterNow TDI] XHR and fetch interceptors installed');
})();
