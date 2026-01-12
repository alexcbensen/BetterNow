/*
 * Alex's BetterNow - WebSocket Blocker (Page Context)
 * Blocks WebSocket connections to specific YouNow broadcast rooms
 */

(function() {
    // Prevent double injection
    if (window.__betternowWsBlockerInjected) return;
    window.__betternowWsBlockerInjected = true;

    const OriginalWebSocket = window.WebSocket;
    const blockedRooms = new Set();

    // Listen for messages from content script
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'BETTERNOW_BLOCK_ROOM') {
            blockedRooms.add(String(event.data.roomId));
            console.log('[BetterNow WS] Blocking room:', event.data.roomId);
        }
        if (event.data && event.data.type === 'BETTERNOW_UNBLOCK_ROOM') {
            blockedRooms.delete(String(event.data.roomId));
            console.log('[BetterNow WS] Unblocking room:', event.data.roomId);
        }
    });

    window.__betternowBlockRoom = function(roomId) {
        blockedRooms.add(String(roomId));
        console.log('[BetterNow WS] Blocking room:', roomId);
    };

    window.__betternowUnblockRoom = function(roomId) {
        blockedRooms.delete(String(roomId));
        console.log('[BetterNow WS] Unblocking room:', roomId);
    };

    window.__betternowGetBlockedRooms = function() {
        return Array.from(blockedRooms);
    };

    window.WebSocket = function(url, protocols) {
        // Check if this is a YouNow signaling connection
        if (url && url.includes('signaling.younow-prod.video')) {
            const roomMatch = url.match(/roomId=(\d+)/);
            if (roomMatch && blockedRooms.has(roomMatch[1])) {
                console.log('[BetterNow WS] Blocked WebSocket for room:', roomMatch[1]);
                // Return a dummy WebSocket that does nothing
                const dummy = {
                    readyState: 3, // CLOSED
                    send: function() {},
                    close: function() {},
                    addEventListener: function() {},
                    removeEventListener: function() {},
                    onopen: null,
                    onclose: null,
                    onerror: null,
                    onmessage: null
                };
                return dummy;
            }
        }

        if (protocols) {
            return new OriginalWebSocket(url, protocols);
        }
        return new OriginalWebSocket(url);
    };

    window.WebSocket.prototype = OriginalWebSocket.prototype;
    window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    window.WebSocket.OPEN = OriginalWebSocket.OPEN;
    window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
    window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;

    console.log('[BetterNow WS] WebSocket blocker initialized');
})();