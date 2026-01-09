/*
 * Alex's BetterNow - Filter Bypass (Page Context)
 */

(function() {
    const magicChar = String.fromCharCode(8203); // zero-width space

    // Decode the word list (obfuscated to keep source clean)
    const _0x = 'WyJhaG9sZSIsImFtY2lrIiwiYW5kc2tvdGEiLCJhbnVzIiwiYXJzY2hsb2NoIiwiYXJzZSIsImFzaDBsZSIsImFzaDBsZXMiLCJhc2hvbGVzIiwiYXNzIiwiYXNzZmFjZSIsImFzc2gwbGUiLCJhc3NoMGxleiIsImFzc2hvbGUiLCJhc3Nob2xlcyIsImFzc2hvbHoiLCJhc3NyYW1tZXIiLCJhc3N3aXBlIiwiYXlpciIsImF6emhvbGUiLCJiYXNzdGVyZHMiLCJiYXN0YXJkIiwiYmFzdGFyZHMiLCJiYXN0YXJkeiIsImJhc3RlcmRzIiwiYmFzdGVyZHoiLCJiaWF0Y2giLCJiaXRjaCIsImJpdGNoZXMiLCJiaXRjaGluZyIsImJpdGNoeSIsImJsb3dqb2IiLCJib2ZmaW5nIiwiYm9pb2xhcyIsImJvbGxvY2siLCJib2xsb2NrcyIsImJvb2IiLCJib29icyIsImJvb2JpZSIsImJvb2JpZXMiLCJicmVhc3RzIiwiYnVjZXRhIiwiYnV0dCIsImJ1dHRob2xlIiwiYnV0dHdpcGUiLCJjYWJyb24iLCJjYXdrIiwiY2F3a3MiLCJjYXp6byIsImNoaW5rIiwiY2hyYWEiLCJjaHVqIiwiY2lwYSIsImNsaXQiLCJjbGl0cyIsImNudHMiLCJjbnR6IiwiY29jayIsImNvY2toZWFkIiwiY29ja3MiLCJjb2Nrc3Vja2VyIiwiY3JhcCIsImNyYXBweSIsImN1bSIsImN1bW1pbmciLCJjdW1zaG90IiwiY3VudCIsImN1bnRzIiwiY3VudHoiLCJkYW1uIiwiZGFtbmVkIiwiZGFtbWl0IiwiZGF5Z28iLCJkZWdvIiwiZGljayIsImRpY2toZWFkIiwiZGlja3MiLCJkaWtlIiwiZGlsZG8iLCJkaWxkb3MiLCJkaXJzYSIsImRvbWluYXRyaXgiLCJkdXBhIiwiZHlrZSIsImR6aXdrYSIsImVqYWNrdWxhdGUiLCJlamFrdWxhdGUiLCJlbmN1bGVyIiwiZW5lbWEiLCJmYWciLCJmYWdldCIsImZhZ2cwdCIsImZhZ2dpdCIsImZhZ2dvdCIsImZhZ2l0IiwiZmFncyIsImZhZ3oiLCJmYWlnIiwiZmFpZ3MiLCJmYW5jdWxvIiwiZmFubnkiLCJmYXJ0IiwiZmF0YXNzIiwiZmN1ayIsImZlY2VzIiwiZmVsY2hlciIsImZpY2tlbiIsImZsaWtrZXIiLCJmb3Jlc2tpbiIsImZvdHplIiwiZnVjayIsImZ1Y2tlZCIsImZ1Y2tlciIsImZ1Y2tlcnMiLCJmdWNraW4iLCJmdWNraW5nIiwiZnVja3MiLCJmdWsiLCJmdWthaCIsImZ1a2VuIiwiZnVrZXIiLCJmdWtpbiIsImZ1a2siLCJmdWtrYWgiLCJmdWtrZW4iLCJmdWtrZXIiLCJmdWtraW4iLCJmdXRrcmV0em4iLCJnb29rIiwiZ3VpZW5hIiwiaGFuZGpvYiIsImhlbGwiLCJoZWxscyIsImhlbHZldGUiLCJob2FyIiwiaG9lciIsImhvbmtleSIsImhvb3IiLCJob29yZSIsImhvcmUiLCJob3JueSIsImh1ZXZvbiIsImh1aSIsImluanVuIiwiamFja29mZiIsImphcCIsImphcHMiLCJqZXJrb2ZmIiwiamlzaW0iLCJqaXNtIiwiamlzcyIsImppem0iLCJqaXp6Iiwia2Fua2VyIiwia2F3ayIsImtpa2UiLCJraWxsIiwia2lsbGluZyIsImtsb290emFrIiwia21zIiwia25vYiIsImtub2JzIiwia25vYnoiLCJrbnVsbGUiLCJrcmF1dCIsImt1ayIsImt1a3N1Z2VyIiwia3VudCIsImt1bnRzIiwia3VudHoiLCJrdXJhYyIsImt1cndhIiwia3VzaSIsImt5cyIsImt5cnBhIiwibGVzYm8iLCJsZXp6aWFuIiwibGlwc2hpdHMiLCJsaXBzaGl0eiIsIm1hbWhvb24iLCJtYXNvY2hpc3QiLCJtYXNva2lzdCIsIm1hc3N0ZXJiYWl0IiwibWFzc3RyYmFpdCIsIm1hc3N0cmJhdGUiLCJtYXN0ZXJiYWl0ZXIiLCJtYXN0ZXJiYXRlIiwibWFzdGVyYmF0ZXMiLCJtYXN0dXJiYXRlIiwibWFzdHVyYmF0aW5nIiwibWFzdHVyYmF0aW9uIiwibWVyZCIsIm1pYnVuIiwibW9mbyIsIm1vbmtsZWlnaCIsIm1vdGhlcmZ1Y2tlciIsIm1vdGhlcmZ1Y2tlcnMiLCJtb3VsaWV3b3AiLCJtdWllIiwibXVsa2t1IiwibXVyZGVyIiwibXVzY2hpIiwibmFzdHQiLCJuYXppIiwibmF6aXMiLCJuZXBlc2F1cmlvIiwibmlnZ2EiLCJuaWdnYXMiLCJuaWdnZXIiLCJuaWdnZXJzIiwibmlndXIiLCJuaWlnZXIiLCJuaWlnciIsIm51ZGUiLCJudWRlcyIsIm5ha2VkIiwibnV0c2FjayIsIm9yYWZpcyIsIm9yZ2FzaW0iLCJvcmdhc20iLCJvcmdhc21zIiwib3JnYXN1bSIsIm9yaWZhY2UiLCJvcmlmaWNlIiwib3JpZmlzcyIsIm9yb3NwdSIsInBhY2tpIiwicGFja2llIiwicGFja3kiLCJwYWtpIiwicGFraWUiLCJwYWt5IiwicGFza2EiLCJwZWNrZXIiLCJwZWVlbnVzIiwicGVlZW51c3NzIiwicGVlbnVzIiwicGVpbnVzIiwicGVuYXMiLCJwZW5pcyIsInBlbnVzIiwicGVudXVzIiwicGVyc2UiLCJwaHVjIiwicGh1Y2siLCJwaHVrIiwicGh1a2VyIiwicGh1a2tlciIsInBpY2thIiwicGllcmRvbCIsInBpbGx1IiwicGltbWVsIiwicGltcGlzIiwicGlzcyIsInBpc3NlZCIsInBpc3NpbmciLCJwaXpkYSIsInBvbGFjIiwicG9sYWNrIiwicG9sYWsiLCJwb29uYW5pIiwicG9vbnRzZWUiLCJwb29wIiwicG9ybiIsInBvcm5vIiwicG9ybm9ncmFwaHkiLCJwcmV0ZWVuIiwicHJpY2siLCJwdWxhIiwicHVsZSIsInB1c3NlIiwicHVzc2VlIiwicHVzc3kiLCJwdXNzaWVzIiwicHV0YSIsInB1dG8iLCJwdXVrZSIsInB1dWtlciIsInFhaGJlaCIsInF1ZWVmIiwicXVlZXIiLCJyYXBlIiwicmFwZWQiLCJyYXBpbmciLCJyYXBpc3QiLCJyYXV0ZW5iZXJnIiwicmVja3R1bSIsInJlY3R1bSIsInJldGFyZCIsInJldGFyZGVkIiwicmV0YXJkcyIsInNhZGlzdCIsInNjYW5rIiwic2NoYWZmZXIiLCJzY2hlaXNzIiwic2NobGFtcGUiLCJzY2hsb25nIiwic2NobXVjayIsInNjcmV3Iiwic2NyZXdpbmciLCJzY3JvdHVtIiwic2VtZW4iLCJzZXgiLCJzZXh1YWwiLCJzZXh5Iiwic2hhcm11dGEiLCJzaGFybXV0ZSIsInNoZW1hbGUiLCJzaGlwYWwiLCJzaGl0Iiwic2hpdHMiLCJzaGl0dGVyIiwic2hpdHR5Iiwic2hpdHkiLCJzaGl0eiIsInNoaXoiLCJzaHl0Iiwic2h5dGUiLCJzaHl0dHkiLCJzaHl0eSIsInNrYW5jayIsInNrYW5rIiwic2thbmtlZSIsInNrYW5rZXkiLCJza2Fua3MiLCJza2Fua3kiLCJza3JpYnoiLCJza3Vyd3lzeW4iLCJzbGFnIiwic2x1dCIsInNsdXRzIiwic2x1dHR5Iiwic2x1dHoiLCJzbXV0Iiwic3BoZW5jdGVyIiwic3BpYyIsInNwaWVyZGFsYWoiLCJzcGxvb2dlIiwic3VpY2lkZSIsInN1a2EiLCJ0ZWV0cyIsInRlZXoiLCJ0ZXN0aWNhbCIsInRlc3RpY2xlIiwidGVzdGljbGVzIiwidGl0IiwidGl0cyIsInRpdHQiLCJ0aXR0eSIsInRpdHRpZXMiLCJ0dXJkIiwidHdhdCIsInR3YXRzIiwidmFnaW5hIiwidmFnaWluYSIsInZhamluYSIsInZpdHR1IiwidnVsbHZhIiwidnVsdmEiLCJ3YW5rIiwid2Fua2VyIiwid2Fua2VycyIsIndhbmtpbmciLCJ3ZXRiYWNrIiwid2hvYXIiLCJ3aG9yZSIsIndob3JlcyIsIndpY2hzZXIiLCJ3b3AiLCJ4cmF0ZWQiLCJ4eHgiLCJ5ZWQiLCJ6YWJvdXJhaCJd';
    const badWords = JSON.parse(atob(_0x));

    // Create a regex pattern that matches whole words (case insensitive)
    const badWordsPattern = new RegExp('\\b(' + badWords.join('|') + ')\\b', 'gi');

    function obfuscateWord(word) {
        // Insert zero-width space after each character
        let result = '';
        for (let i = 0; i < word.length; i++) {
            result += word[i] + magicChar;
        }
        return result;
    }

    function obfuscateChatText(text) {
        // Only obfuscate words that match the bad words list
        return text.replace(badWordsPattern, (match) => obfuscateWord(match));
    }

    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        if (window.__betternowFilterBypass && options && options.body && typeof options.body === "string" && options.body.indexOf("comment=") >= 0) {
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
        if (window.__betternowFilterBypass && typeof data === "string" && data.indexOf("comment=") >= 0) {
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
    });

    // Set initial state from localStorage
    window.__betternowFilterBypass = localStorage.getItem('betternow_chatFilterBypass') === 'true';
})();