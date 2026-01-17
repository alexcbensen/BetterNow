// ============ Presence System ============
// Tracks online BetterNow users across the platform
// Uses a single Firebase document for efficient reads

const PRESENCE_DEBUG = false; // SET TO FALSE FOR PRODUCTION

// Heartbeat intervals based on idle state
const PRESENCE_HEARTBEAT_ACTIVE_MS = 300000;      // 5 minutes - watching stream or idle < 15min
const PRESENCE_HEARTBEAT_IDLE_15_MS = 600000;     // 10 minutes - idle 15-30min
const PRESENCE_HEARTBEAT_IDLE_30_MS = 1200000;    // 20 minutes - idle 30-60min

// Idle thresholds
const PRESENCE_IDLE_15_MS = 900000;               // 15 minutes
const PRESENCE_IDLE_30_MS = 1800000;              // 30 minutes
const PRESENCE_IDLE_60_MS = 3600000;              // 60 minutes - pause heartbeat
const PRESENCE_STALE_MS = 43200000;               // 12 hours - drop from list

const PRESENCE_MIN_UPDATE_INTERVAL_MS = 120000;   // Don't update more than once per 2 minutes

function presenceLog(...args) {
    if (PRESENCE_DEBUG) {
        console.log('[BetterNow Presence]', new Date().toISOString().substr(11, 12), ...args);
    }
}

function presenceWarn(...args) {
    console.warn('[BetterNow Presence]', ...args);
}

function presenceError(...args) {
    console.error('[BetterNow Presence]', ...args);
}

// Detect browser platform from user agent
function detectBrowserPlatform() {
    const ua = navigator.userAgent;
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Chrome/')) return 'Chrome';
    return 'Unknown';
}

// Safely get extension version (handles invalidated context after extension reload)
function getExtensionVersion() {
    try {
        return chrome.runtime.getManifest().version;
    } catch (e) {
        // Extension context invalidated - user needs to refresh the page
        return 'Unknown';
    }
}

// Module loaded log removed for production

let presenceHeartbeatInterval = null;
let currentHeartbeatMs = PRESENCE_HEARTBEAT_ACTIVE_MS; // Current heartbeat interval
let lastPresenceUpdate = 0;
let lastPresenceStream = null; // Track last stream to detect meaningful changes
let lastStreamTime = Date.now(); // Track when user last watched a stream
let heartbeatPaused = false; // Track if heartbeat is paused (1hr+ idle)

// Cache the resolved username to avoid repeated API calls
let cachedUsername = null;
let cachedUsernameForId = null;

// Get current stream info from URL
function getCurrentStreamInfo() {
    const path = window.location.pathname;
    const match = path.match(/^\/([^\/]+)/);

    if (!match) return { stream: null, url: null, isGuesting: false };

    const streamName = match[1].toLowerCase();

    // Exclude non-stream pages
    if (['explore', 'moments', 'settings', 'inbox', ''].includes(streamName)) {
        return { stream: null, url: null, isGuesting: false };
    }

    // Check if "broadcast not found" toast is showing - stream is dead
    const deadStreamToast = document.querySelector('.toast-error .toast-title[aria-label*="broadcast could not be found"]');
    if (deadStreamToast) {
        presenceLog('getCurrentStreamInfo: Dead stream toast detected, not reporting as watching');
        return { stream: null, url: null, isGuesting: false };
    }

    // Check if user is guesting FIRST (their tile shows "You")
    // If guesting, we know the stream is live - no need to check .broadcaster-is-online
    const guestTiles = document.querySelectorAll('.fullscreen-wrapper > .video');
    let isGuesting = false;
    for (const tile of guestTiles) {
        const usernameEl = tile.querySelector('.username span');
        if (usernameEl && usernameEl.textContent.trim() === 'You') {
            isGuesting = true;
            break;
        }
    }

    // If guesting, definitely on a live stream
    if (isGuesting) {
        presenceLog('getCurrentStreamInfo: User is guesting, stream is live');
        return {
            stream: streamName,
            url: path,
            isGuesting: true
        };
    }

    // Not guesting - check if broadcaster is online
    const isLive = document.querySelector('.broadcaster-is-online') !== null;
    if (!isLive) {
        presenceLog('getCurrentStreamInfo: broadcaster-is-online not found, not reporting as watching');
        return { stream: null, url: null, isGuesting: false };
    }

    return {
        stream: streamName,
        url: path,
        isGuesting: false
    };
}

// Update user's presence in Firebase
async function updatePresence(force = false) {
    presenceLog('updatePresence() called, force:', force);

    // Don't update if extension is disabled or no user ID
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) {
        presenceLog('updatePresence: Skipped - extension disabled');
        return;
    }
    if (!currentUserId) {
        presenceLog('updatePresence: Skipped - no currentUserId');
        return;
    }
    if (typeof FIRESTORE_BASE_URL === 'undefined' || !FIRESTORE_BASE_URL) {
        presenceLog('updatePresence: Skipped - FIRESTORE_BASE_URL not defined');
        return;
    }

    const now = Date.now();
    const streamInfo = getCurrentStreamInfo();

    // Throttle updates unless forced or stream changed
    const timeSinceLastUpdate = now - lastPresenceUpdate;
    const streamChanged = streamInfo.stream !== lastPresenceStream;

    if (!force && !streamChanged && timeSinceLastUpdate < PRESENCE_MIN_UPDATE_INTERVAL_MS) {
        presenceLog('updatePresence: Skipped - throttled (last update', timeSinceLastUpdate, 'ms ago)');
        return;
    }

    // Get username - priority:
    // 1. Cached username (if same user ID)
    // 2. Profile dropdown (if visible)
    // 3. Fetch from YouNow API (once, then cache)
    let username = null;

    // Check cache first
    if (cachedUsername && cachedUsernameForId === currentUserId) {
        username = cachedUsername;
        presenceLog('updatePresence: Using cached username:', username);
    }

    // Try profile dropdown
    if (!username) {
        const usernameEl = document.querySelector('app-profile-dropdown .username');
        if (usernameEl && usernameEl.textContent.trim()) {
            username = usernameEl.textContent.trim();
            cachedUsername = username;
            cachedUsernameForId = currentUserId;
            presenceLog('updatePresence: Got username from dropdown:', username);
        }
    }

    // Fetch from API if still no username
    if (!username) {
        presenceLog('updatePresence: Fetching username from YouNow API...');
        try {
            const response = await fetch(`https://cdn.younow.com/php/api/channel/getInfo/channelId=${currentUserId}`);
            const data = await response.json();
            if (data.profile) {
                username = data.profile;
                cachedUsername = username;
                cachedUsernameForId = currentUserId;
                presenceLog('updatePresence: Got username from API:', username);
            }
        } catch (e) {
            presenceWarn('updatePresence: Failed to fetch username from API:', e);
        }
    }

    // Final fallback
    if (!username) {
        username = `User${currentUserId}`;
        presenceLog('updatePresence: Using fallback username:', username);
    }

    // Firestore field names can't start with a number, so prefix with 'u'
    const odiskdKey = `u${currentUserId}`;

    // Update lastStreamTime if user is watching a stream
    if (streamInfo.stream) {
        lastStreamTime = now;
        // Resume heartbeat if it was paused
        if (heartbeatPaused) {
            presenceLog('updatePresence: User entered stream, resuming heartbeat');
            heartbeatPaused = false;
            adjustHeartbeatInterval();
        }
    }

    // Check if user already has firstSeen (don't overwrite on subsequent updates)
    let existingFirstSeen = null;
    try {
        const existingResponse = await fetch(`${FIRESTORE_BASE_URL}/presence/online`);
        if (existingResponse.ok) {
            const existingData = await existingResponse.json();
            const existingUser = existingData.fields?.[odiskdKey]?.mapValue?.fields;
            existingFirstSeen = existingUser?.firstSeen?.integerValue;
            presenceLog('updatePresence: Existing firstSeen:', existingFirstSeen);
        }
    } catch (e) {
        presenceLog('updatePresence: Could not check existing firstSeen:', e.message);
    }

    const firstSeen = existingFirstSeen ? parseInt(existingFirstSeen) : now;

    // Build presence data
    const presenceData = {
        odiskd: currentUserId,
        username: username,
        avatar: `https://ynassets.younow.com/user/live/${currentUserId}/${currentUserId}.jpg`,
        stream: streamInfo.stream,
        streamUrl: streamInfo.url,
        isGuesting: streamInfo.isGuesting,
        lastSeen: now,
        lastStreamTime: lastStreamTime,
        // New tracking fields
        firstSeen: firstSeen,
        version: getExtensionVersion(),
        platform: detectBrowserPlatform()
    };

    presenceLog('updatePresence: Sending data:', presenceData);
    presenceLog('updatePresence: Using field key:', odiskdKey);

    try {
        // Use PATCH to update just this user's entry in the presence map
        const url = `${FIRESTORE_BASE_URL}/presence/online?updateMask.fieldPaths=${odiskdKey}`;
        presenceLog('updatePresence: PATCH to', url);

        const response = await fetch(
            url,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: {
                        [odiskdKey]: {
                            mapValue: {
                                fields: {
                                    odiskd: { stringValue: presenceData.odiskd },
                                    username: { stringValue: presenceData.username },
                                    avatar: { stringValue: presenceData.avatar },
                                    stream: { stringValue: presenceData.stream || '' },
                                    streamUrl: { stringValue: presenceData.streamUrl || '' },
                                    isGuesting: { booleanValue: presenceData.isGuesting || false },
                                    lastSeen: { integerValue: presenceData.lastSeen },
                                    lastStreamTime: { integerValue: presenceData.lastStreamTime },
                                    firstSeen: { integerValue: presenceData.firstSeen },
                                    version: { stringValue: presenceData.version },
                                    platform: { stringValue: presenceData.platform }
                                }
                            }
                        }
                    }
                })
            }
        );

        // Signal that presence system is ready (even if write fails, reads can still work)
        if (!window.presenceReady) {
            window.presenceReady = true;
            presenceLog('updatePresence: presenceReady flag set to true');
        }

        if (response.ok) {
            lastPresenceUpdate = now;
            lastPresenceStream = streamInfo.stream;
            presenceLog('updatePresence: SUCCESS - response status:', response.status);
        } else {
            const errorText = await response.text();
            presenceWarn('updatePresence: FAILED - status:', response.status, 'body:', errorText);
        }
    } catch (e) {
        // Still mark presence as ready - reads can work even if writes fail
        if (!window.presenceReady) {
            window.presenceReady = true;
            presenceLog('updatePresence: presenceReady flag set to true (despite error)');
        }
        // Don't log network errors (expected when offline/throttled)
        if (e.message !== 'Failed to fetch') {
            presenceError('updatePresence: ERROR:', e);
        }
    }
}

// Remove user's presence from Firebase (on page unload)
async function removePresence() {
    if (!currentUserId) return;

    // Firestore field names can't start with a number, so prefix with 'u'
    const odiskdKey = `u${currentUserId}`;

    presenceLog('Removing presence for:', currentUserId, '(key:', odiskdKey + ')');

    try {
        // Set lastSeen to 0 to mark as offline (will be filtered out)
        await fetch(
            `${FIRESTORE_BASE_URL}/presence/online?updateMask.fieldPaths=${odiskdKey}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: {
                        [odiskdKey]: {
                            mapValue: {
                                fields: {
                                    lastSeen: { integerValue: 0 }
                                }
                            }
                        }
                    }
                })
            }
        );
    } catch (e) {
        // Ignore errors on unload
    }
}

// Fetch all online users (admin only)
async function fetchOnlineUsers() {
    presenceLog('fetchOnlineUsers() called');

    try {
        const url = `${FIRESTORE_BASE_URL}/presence/online`;
        presenceLog('fetchOnlineUsers: GET', url);

        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                presenceLog('fetchOnlineUsers: Document does not exist yet (404)');
                return [];
            }
            presenceWarn('fetchOnlineUsers: FAILED - status:', response.status);
            return [];
        }

        const data = await response.json();
        presenceLog('fetchOnlineUsers: Raw response:', data);

        const now = Date.now();
        const users = [];

        if (data.fields) {
            presenceLog('fetchOnlineUsers: Found', Object.keys(data.fields).length, 'entries in document');

            for (const [fieldKey, value] of Object.entries(data.fields)) {
                // Field keys are prefixed with 'u', e.g. 'u60974148'
                // The actual odiskd is stored inside the map
                if (value.mapValue && value.mapValue.fields) {
                    const fields = value.mapValue.fields;
                    const lastSeen = parseInt(fields.lastSeen?.integerValue) || 0;
                    const age = now - lastSeen;
                    const odiskd = fields.odiskd?.stringValue || fieldKey.replace(/^u/, '');

                    presenceLog(`fetchOnlineUsers: User ${odiskd} (key: ${fieldKey}) - lastSeen ${age}ms ago, stale threshold: ${PRESENCE_STALE_MS}ms`);

                    // Filter out stale users (offline for more than PRESENCE_STALE_MS)
                    if (age < PRESENCE_STALE_MS) {
                        users.push({
                            odiskd: odiskd,
                            username: fields.username?.stringValue || 'Unknown',
                            avatar: fields.avatar?.stringValue || '',
                            stream: fields.stream?.stringValue || null,
                            streamUrl: fields.streamUrl?.stringValue || null,
                            isGuesting: fields.isGuesting?.booleanValue || false,
                            lastSeen: lastSeen,
                            lastStreamTime: parseInt(fields.lastStreamTime?.integerValue) || lastSeen,
                            firstSeen: parseInt(fields.firstSeen?.integerValue) || lastSeen,
                            version: fields.version?.stringValue || 'Unknown',
                            platform: fields.platform?.stringValue || 'Unknown'
                        });
                        presenceLog(`fetchOnlineUsers: User ${fields.username?.stringValue || odiskd} is ONLINE`);
                    } else {
                        presenceLog(`fetchOnlineUsers: User ${fields.username?.stringValue || odiskd} is STALE (${Math.round(age/1000)}s old)`);
                    }
                }
            }
        } else {
            presenceLog('fetchOnlineUsers: No fields in document');
        }

        // Sort by lastSeen (most recent first)
        users.sort((a, b) => b.lastSeen - a.lastSeen);

        presenceLog('fetchOnlineUsers: Returning', users.length, 'online users:', users.map(u => u.username));
        return users;

    } catch (e) {
        presenceError('fetchOnlineUsers: ERROR:', e);
        return [];
    }
}

// Calculate appropriate heartbeat interval based on idle time
function getHeartbeatInterval() {
    const now = Date.now();
    const idleTime = now - lastStreamTime;

    if (idleTime >= PRESENCE_IDLE_60_MS) {
        // Idle 1+ hour - pause heartbeat
        return null;
    } else if (idleTime >= PRESENCE_IDLE_30_MS) {
        // Idle 30-60 min
        return PRESENCE_HEARTBEAT_IDLE_30_MS;
    } else if (idleTime >= PRESENCE_IDLE_15_MS) {
        // Idle 15-30 min
        return PRESENCE_HEARTBEAT_IDLE_15_MS;
    } else {
        // Active or idle < 15 min
        return PRESENCE_HEARTBEAT_ACTIVE_MS;
    }
}

// Adjust heartbeat interval based on idle state
function adjustHeartbeatInterval() {
    const newInterval = getHeartbeatInterval();

    // Pause heartbeat if idle 1+ hour
    if (newInterval === null) {
        if (!heartbeatPaused) {
            presenceLog('adjustHeartbeatInterval: Pausing heartbeat (idle 1+ hour)');
            heartbeatPaused = true;
            if (presenceHeartbeatInterval) {
                clearInterval(presenceHeartbeatInterval);
                presenceHeartbeatInterval = null;
            }
        }
        return;
    }

    // Resume or adjust interval
    if (newInterval !== currentHeartbeatMs || heartbeatPaused) {
        presenceLog('adjustHeartbeatInterval: Changing interval from', currentHeartbeatMs, 'to', newInterval);
        currentHeartbeatMs = newInterval;
        heartbeatPaused = false;

        // Clear existing interval and set new one
        if (presenceHeartbeatInterval) {
            clearInterval(presenceHeartbeatInterval);
        }

        presenceHeartbeatInterval = setInterval(() => {
            presenceLog('Heartbeat tick (interval:', currentHeartbeatMs, 'ms)');
            updatePresence(true);
            // Check if we need to adjust interval after each tick
            adjustHeartbeatInterval();
        }, currentHeartbeatMs);
    }
}

// Start presence heartbeat
function startPresenceHeartbeat() {
    // Don't start if extension is disabled
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) {
        presenceLog('startPresenceHeartbeat: Skipped - extension disabled');
        return;
    }

    presenceLog('startPresenceHeartbeat: Starting heartbeat system');
    presenceLog('startPresenceHeartbeat: Initial interval:', currentHeartbeatMs, 'ms');
    presenceLog('startPresenceHeartbeat: Stale threshold:', PRESENCE_STALE_MS, 'ms');

    // Initial update (forced)
    presenceLog('startPresenceHeartbeat: Sending initial presence update');
    updatePresence(true);

    // Start with appropriate interval based on current state
    adjustHeartbeatInterval();

    // Update on visibility change (tab becomes visible) - not forced, will be throttled
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            presenceLog('startPresenceHeartbeat: Tab became visible, updating presence');
            updatePresence(); // Not forced - will skip if recently updated
            // Re-check heartbeat interval when tab becomes visible
            adjustHeartbeatInterval();
        }
    });

    // Update on navigation (SPA) - not forced unless stream changes (handled in updatePresence)
    window.addEventListener('betternow:navigation', () => {
        presenceLog('startPresenceHeartbeat: Navigation detected, updating presence in 500ms');
        setTimeout(() => {
            updatePresence(); // Not forced - will update if stream changed
            adjustHeartbeatInterval();
        }, 500);
    });

    // Remove presence on page unload
    window.addEventListener('beforeunload', () => {
        presenceLog('startPresenceHeartbeat: Page unloading, removing presence');
        removePresence();
    });

    presenceLog('startPresenceHeartbeat: All event listeners attached');
}

// Stop presence heartbeat
function stopPresenceHeartbeat() {
    presenceLog('stopPresenceHeartbeat: Stopping heartbeat');
    if (presenceHeartbeatInterval) {
        clearInterval(presenceHeartbeatInterval);
        presenceHeartbeatInterval = null;
    }
}

// Initialize presence system after user is detected
function initPresence() {
    presenceLog('initPresence: Starting initialization');
    presenceLog('initPresence: currentUserId =', typeof currentUserId !== 'undefined' ? currentUserId : 'undefined');
    presenceLog('initPresence: extensionDisabled =', typeof extensionDisabled !== 'undefined' ? extensionDisabled : 'undefined');

    // Wait for currentUserId to be set
    let attempts = 0;
    const checkInterval = setInterval(() => {
        attempts++;

        if (typeof extensionDisabled !== 'undefined' && extensionDisabled) {
            presenceLog('initPresence: Extension disabled, aborting');
            clearInterval(checkInterval);
            return;
        }

        if (currentUserId) {
            presenceLog('initPresence: currentUserId found after', attempts, 'attempts:', currentUserId);
            clearInterval(checkInterval);
            startPresenceHeartbeat();
        } else if (attempts % 10 === 0) {
            presenceLog('initPresence: Waiting for currentUserId... attempt', attempts);
        }
    }, 500);

    // Timeout after 30 seconds
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!currentUserId) {
            presenceWarn('initPresence: Timed out waiting for currentUserId after 30s');
        }
    }, 30000);
}

// Start initialization
presenceLog('initPresence: Scheduling initialization');
initPresence();