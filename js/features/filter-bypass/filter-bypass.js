/*
 * Alex's BetterNow - Filter Bypass (Page Context)
 */

(function() {
    // Prevent double injection
    if (window.__betternowFilterBypassInjected) return;
    window.__betternowFilterBypassInjected = true;
    
    console.log('[BetterNow Filter] Initialized');
    
    const magicChar = String.fromCharCode(8203); // zero-width space
    
    // Word list will be received from content script
    let badWords = [];
    let badWordsPattern = null;
    
    function updateWordList(words) {
        if (!words || !Array.isArray(words) || words.length === 0) {
            console.warn('[BetterNow Filter] Invalid word list received');
            return;
        }
        badWords = words;
        badWordsPattern = new RegExp('\\b(' + badWords.join('|') + ')\\b', 'gi');
        console.log('[BetterNow Filter] Word list loaded:', words.length, 'words');
    }
    
    function obfuscateWord(word) {
        // Insert zero-width space after each character
        let result = '';
        for (let i = 0; i < word.length; i++) {
            result += word[i] + magicChar;
        }
        return result;
    }
    
    function obfuscateChatText(text) {
        // Only obfuscate if we have a word list loaded
        if (!badWordsPattern) return { text, matched: [] };
        
        const matched = [];
        const result = text.replace(badWordsPattern, (match) => {
            matched.push(match);
            return obfuscateWord(match);
        });
        
        return { text: result, matched };
    }
    
    // Intercept fetch - only modify chat POST requests
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        // Only intercept POST requests when bypass is enabled and we have words
        if (window.__betternowFilterBypass && badWordsPattern && options && options.method && options.method.toUpperCase() === 'POST' && options.body && typeof options.body === "string") {
            // Only modify if body has comment= and URL is for posting chat
            if (options.body.indexOf("comment=") >= 0 && typeof url === 'string' && url.indexOf("/php/api/broadcast/chat") >= 0) {
                try {
                    const params = new URLSearchParams(options.body);
                    const comment = params.get("comment");
                    if (comment) {
                        const { text: obfuscated, matched } = obfuscateChatText(comment);
                        if (matched.length > 0) {
                            console.log('[BetterNow Filter] Message obfuscated. Matched words:', matched.join(', '));
                            params.set("comment", obfuscated);
                            options = { ...options, body: params.toString() };
                        }
                    }
                } catch (e) {
                    console.error('[BetterNow Filter] Fetch interception error:', e);
                }
            }
        }
        return originalFetch.call(this, url, options);
    };
    
    // Intercept XMLHttpRequest - only modify chat POST requests
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    
    XMLHttpRequest.prototype.open = function(method, url) {
        this._betternowUrl = url;
        this._betternowMethod = method;
        return originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
        // Only intercept POST requests when bypass is enabled and we have words
        if (window.__betternowFilterBypass && badWordsPattern && this._betternowMethod && this._betternowMethod.toUpperCase() === 'POST' && typeof data === "string" && data.indexOf("comment=") >= 0) {
            // Only modify if URL is SPECIFICALLY for posting chat
            if (this._betternowUrl && this._betternowUrl.indexOf("/php/api/broadcast/chat") >= 0) {
                try {
                    const params = new URLSearchParams(data);
                    const comment = params.get("comment");
                    if (comment) {
                        const { text: obfuscated, matched } = obfuscateChatText(comment);
                        if (matched.length > 0) {
                            console.log('[BetterNow Filter] Message obfuscated. Matched words:', matched.join(', '));
                            params.set("comment", obfuscated);
                            data = params.toString();
                        }
                    }
                } catch (e) {
                    console.error('[BetterNow Filter] XHR interception error:', e);
                }
            }
        }
        return originalXHRSend.call(this, data);
    };
    
    // Listen for messages from content script
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'BETTERNOW_FILTER_BYPASS') {
            window.__betternowFilterBypass = event.data.enabled;
        }
        // Receive word list from content script
        if (event.data && event.data.type === 'BETTERNOW_FILTER_WORDLIST') {
            updateWordList(event.data.words);
        }
    });
    
    // Set initial state from localStorage
    window.__betternowFilterBypass = localStorage.getItem('betternow_chatFilterBypass') === 'true';
})();
