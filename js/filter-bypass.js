/*
 * Alex's BetterNow - Filter Bypass (Page Context)
 */

(function() {
    const magicChar = String.fromCharCode(8203); // zero-width space

    // Word list will be received from content script
    let badWords = [];
    let badWordsPattern = null;

    function updateWordList(words) {
        if (!words || !Array.isArray(words) || words.length === 0) return;
        badWords = words;
        badWordsPattern = new RegExp('\\b(' + badWords.join('|') + ')\\b', 'gi');
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
        if (!badWordsPattern) return text;
        return text.replace(badWordsPattern, (match) => obfuscateWord(match));
    }

    // Intercept fetch - only modify chat comment requests
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        // Only intercept if bypass is enabled, we have words, and it's a chat comment
        if (window.__betternowFilterBypass && badWordsPattern && options && options.body && typeof options.body === "string") {
            // Only modify if this looks like a chat comment request
            if (options.body.indexOf("comment=") >= 0 && (url.indexOf("/comment") >= 0 || url.indexOf("/chat") >= 0 || url.indexOf("api.younow.com") >= 0)) {
                try {
                    const params = new URLSearchParams(options.body);
                    const comment = params.get("comment");
                    if (comment) {
                        params.set("comment", obfuscateChatText(comment));
                        options = { ...options, body: params.toString() };
                    }
                } catch (e) {
                    // If parsing fails, don't modify
                }
            }
        }
        return originalFetch.call(this, url, options);
    };

    // Intercept XMLHttpRequest - only modify chat comment requests
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalXHROpen = XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._betternowUrl = url;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(data) {
        // Only intercept if bypass is enabled, we have words, and it's a chat comment
        if (window.__betternowFilterBypass && badWordsPattern && typeof data === "string" && data.indexOf("comment=") >= 0) {
            // Only modify if this looks like a chat comment request
            if (this._betternowUrl && (this._betternowUrl.indexOf("/comment") >= 0 || this._betternowUrl.indexOf("/chat") >= 0 || this._betternowUrl.indexOf("api.younow.com") >= 0)) {
                try {
                    const params = new URLSearchParams(data);
                    const comment = params.get("comment");
                    if (comment) {
                        params.set("comment", obfuscateChatText(comment));
                        data = params.toString();
                    }
                } catch (e) {
                    // If parsing fails, don't modify
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