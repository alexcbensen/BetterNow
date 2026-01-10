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
    
    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        if (window.__betternowFilterBypass && badWordsPattern && options && options.body && typeof options.body === "string" && options.body.indexOf("comment=") >= 0) {
            const params = new URLSearchParams(options.body);
            const comment = params.get("comment");
            params.set("comment", obfuscateChatText(comment));
            options.body = params.toString();
        }
        return originalFetch.call(this, url, options);
    };
    
    // Intercept XMLHttpRequest
    const originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(data) {
        if (window.__betternowFilterBypass && badWordsPattern && typeof data === "string" && data.indexOf("comment=") >= 0) {
            const params = new URLSearchParams(data);
            const comment = params.get("comment");
            params.set("comment", obfuscateChatText(comment));
            data = params.toString();
        }
        originalXHRSend.call(this, data);
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
