// ============ Active Users ============
// Tracks online BetterNow users for:
// 1. Badge display in chat (via onlineBetterNowUserIds Set used by chat.js)
// 2. Admin Panel "Online Users" section

const ACTIVE_USERS_DEBUG = false; // DEBUG DISABLED

function activeUsersLog(...args) {
    if (ACTIVE_USERS_DEBUG) {
        console.log('[BetterNow ActiveUsers]', new Date().toISOString().substr(11, 12), ...args);
    }
}

// ============ Shared State ============

// Cache of online user IDs (used by chat.js for badge display)
// Must be global (on window) so chat.js can access it
window.onlineBetterNowUserIds = new Set();
var onlineBetterNowUserIds = window.onlineBetterNowUserIds;

// Cache of full online user data (used by admin panel)
let cachedOnlineUsers = null;
let onlineUsersCacheTime = 0;

// Admin panel refresh interval
let onlineUsersRefreshInterval = null;

// Grace period tracking: remembers when we last saw each user in a fetch
// This prevents badges from flickering when a user's heartbeat is delayed
let userLastSeenLocally = new Map(); // odiskd -> timestamp

// Grace period: keep users in the Set for 10 minutes even if they disappear from a fetch
// This covers 2 refresh cycles (5 min each) to handle temporary outages
const LOCAL_GRACE_PERIOD_MS = 600000; // 10 minutes

// ============ Core Functions ============

// Helper: Check if user is currently viewing a stream
function isViewingStream() {
    // These elements only exist on stream pages
    return !!(
        document.querySelector('app-chat-list') ||
        document.querySelector('app-audience') ||
        document.querySelector('app-broadcast')
    );
}

// Fetch online users and update caches
async function updateOnlineBetterNowUsers() {
    if (typeof fetchOnlineUsers !== 'function') {
        activeUsersLog('updateOnlineBetterNowUsers: fetchOnlineUsers not available');
        return [];
    }

    try {
        const users = await fetchOnlineUsers();
        const now = Date.now();

        // Check if we're in a stream (grace period only applies in streams)
        const inStream = isViewingStream();

        // Update local tracking for users we just fetched
        for (const user of users) {
            const odiskd = String(user.odiskd);
            userLastSeenLocally.set(odiskd, now);
        }

        // Build new Set starting with freshly fetched users
        const newOnlineSet = new Set(users.map(u => String(u.odiskd)));

        // If in a stream, apply grace period to preserve recently-seen users
        // This prevents badge flickering when heartbeats are delayed
        if (inStream) {
            for (const odiskd of window.onlineBetterNowUserIds) {
                const lastSeen = userLastSeenLocally.get(odiskd);
                if (lastSeen && (now - lastSeen) < LOCAL_GRACE_PERIOD_MS) {
                    newOnlineSet.add(odiskd);
                }
            }
        }

        // Clean up old entries from tracking map (prevent memory leak)
        for (const [odiskd, timestamp] of userLastSeenLocally.entries()) {
            if (now - timestamp > LOCAL_GRACE_PERIOD_MS) {
                userLastSeenLocally.delete(odiskd);
            }
        }

        // Update ID set for badge display (update both local and window reference)
        window.onlineBetterNowUserIds = newOnlineSet;
        onlineBetterNowUserIds = window.onlineBetterNowUserIds;

        // Update full cache for admin panel (always use actual fetched data, not padded)
        cachedOnlineUsers = users;
        onlineUsersCacheTime = now;

        activeUsersLog('updateOnlineBetterNowUsers: Got', users.length, 'from server,',
            newOnlineSet.size, 'in Set (grace period active:', inStream, ')');

        // Trigger presence-dependent styling (badges, online indicators)
        // Uses applyPresenceStyles() which is separate from applyChatStyles()
        // so that borders/colors load instantly without waiting for presence
        if (typeof applyPresenceStyles === 'function') {
            activeUsersLog('updateOnlineBetterNowUsers: Calling applyPresenceStyles');
            applyPresenceStyles();
        } else {
            activeUsersLog('updateOnlineBetterNowUsers: applyPresenceStyles not available!');
        }

        return users;
    } catch (e) {
        console.error('[BetterNow ActiveUsers] Failed to fetch online users:', e);
        return [];
    }
}

// ============ Admin Panel Rendering ============

// Helper: format time ago
function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 120) return '1m ago';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 7200) return '1h ago';
    return Math.floor(seconds / 3600) + 'h ago';
}

// Render online users list in admin panel
async function renderOnlineUsers(forceRefresh = false) {
    activeUsersLog('renderOnlineUsers() called, forceRefresh:', forceRefresh);

    const container = document.getElementById('online-users-list');
    const countBadge = document.getElementById('online-users-count');

    if (!container) {
        activeUsersLog('renderOnlineUsers: Container #online-users-list not found');
        return;
    }

    let users;

    // Use cache if available and not forcing refresh
    if (!forceRefresh && cachedOnlineUsers !== null) {
        users = cachedOnlineUsers;
        activeUsersLog('renderOnlineUsers: Using cached data,', users.length, 'users');
    } else {
        activeUsersLog('renderOnlineUsers: Fetching fresh data...');
        container.innerHTML = '<p style="color: #888; font-size: 13px;">Loading...</p>';

        users = await updateOnlineBetterNowUsers();
        activeUsersLog('renderOnlineUsers: Got', users.length, 'users');
    }

    // Filter out current user for display count
    const displayUsers = users.filter(user => {
        if (typeof currentUserId !== 'undefined' && currentUserId) {
            return String(user.odiskd) !== String(currentUserId);
        }
        return true;
    });

    // Count only active users (watching a stream OR idle < 15 min)
    const activeUsers = displayUsers.filter(user => {
        if (user.stream) return true; // Watching or guesting
        const now = Date.now();
        const idleTime = now - (user.lastStreamTime || user.lastSeen);
        return idleTime < 900000; // Less than 15 minutes idle
    });

    // Update count badge (only active users, excluding self)
    if (countBadge) {
        countBadge.textContent = activeUsers.length;
        activeUsersLog('renderOnlineUsers: Updated count badge to', activeUsers.length, '(active) out of', displayUsers.length, '(total)');
    }

    if (users.length === 0) {
        activeUsersLog('renderOnlineUsers: No users online, showing empty state');
        container.innerHTML = '<p style="color: #888; font-size: 13px;">No users online</p>';
        return;
    }

    activeUsersLog('renderOnlineUsers: Rendering', displayUsers.length, 'users (filtered from', users.length, ')');

    if (displayUsers.length === 0) {
        container.innerHTML = '<p style="color: #888; font-size: 13px;">No other users online</p>';
        return;
    }

    // Helper: calculate idle time for a user
    const getIdleTime = (user) => Date.now() - (user.lastStreamTime || user.lastSeen);

    // Helper: check if user was active in the last 15 minutes
    const isRecentlyActive = (user) => getIdleTime(user) < 900000;

    // Helper: check if user is broadcasting (watching themselves AND recently active)
    const isLive = (user) => {
        return user.stream &&
            user.stream.toLowerCase() === user.username.toLowerCase() &&
            isRecentlyActive(user);
    };

    // Sort users: live broadcasters first, then viewers watching streams, then idle
    const sortedUsers = [...displayUsers].sort((a, b) => {
        const aLive = isLive(a);
        const bLive = isLive(b);
        // Live broadcasters first
        if (aLive && !bLive) return -1;
        if (!aLive && bLive) return 1;
        // Then users actively watching a stream (recently active with stream set)
        // Note: stream field is only set if broadcaster was live when heartbeat was sent
        const aWatching = a.stream && isRecentlyActive(a);
        const bWatching = b.stream && isRecentlyActive(b);
        if (aWatching && !bWatching) return -1;
        if (!aWatching && bWatching) return 1;
        return 0;
    });

    // Render user list
    container.innerHTML = sortedUsers.map(user => {
        const idleTime = getIdleTime(user);
        const recentlyActive = isRecentlyActive(user);

        // Show "LIVE" badge if broadcasting, otherwise show stream info or idle status
        // Note: stream field is only populated if broadcaster was live at heartbeat time
        let streamHtml = '';
        if (isLive(user)) {
            streamHtml = `<a href="/${user.username}" target="_blank" style="
                display: inline-block;
                width: 36px;
                text-align: center;
                background: var(--color-red, #eb3456);
                color: var(--color-white, #fff);
                border-radius: 4px;
                text-transform: uppercase;
                font-size: 10px;
                font-weight: 600;
                letter-spacing: 0.1em;
                padding: 3px 0 2px 0;
                text-decoration: none;
                cursor: pointer;
            ">Live</a>`;
        } else if (user.stream && recentlyActive) {
            // Show "watching/guesting" - stream was verified live at heartbeat time
            const action = user.isGuesting ? 'guesting' : 'watching';
            streamHtml = `<span style="color: #888; font-size: 12px;">${action} </span><a href="/${user.stream}" target="_blank" style="color: #888; font-size: 12px; text-decoration: none;">${user.stream}</a>`;
        } else if (idleTime >= 3600000) {
            // Idle 1+ hour - "idle for Xh"
            const hours = Math.floor(idleTime / 3600000);
            streamHtml = `<span style="color: #666; font-size: 12px;">idle for ${hours}h</span>`;
        } else if (idleTime >= 1800000) {
            // Idle 30-60 min - "last seen ~30m ago"
            streamHtml = `<span style="color: #888; font-size: 12px;">last seen ~30m ago</span>`;
        } else if (idleTime >= 900000) {
            // Idle 15-30 min - "last seen ~15m ago"
            streamHtml = `<span style="color: #888; font-size: 12px;">last seen ~15m ago</span>`;
        } else {
            // Idle < 15 min - "online"
            streamHtml = `<span style="color: #888; font-size: 12px;">online</span>`;
        }

        const timeAgo = getTimeAgo(user.lastSeen);

        return `
            <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #2a2a2a;
                border-radius: 6px;
                padding: 8px 12px;
                margin-bottom: 6px;
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="position: relative;">
                        <img src="${user.avatar}" alt="" style="
                            width: 32px;
                            height: 32px;
                            border-radius: 50%;
                            background: #444;
                        " onerror="this.style.display='none'" />
                        <div style="
                            position: absolute;
                            bottom: 0;
                            right: 0;
                            width: 10px;
                            height: 10px;
                            background: #08d687;
                            border-radius: 50%;
                            border: 2px solid #2a2a2a;
                        "></div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                        <span style="color: #fff; font-size: 14px;">${user.username}</span>
                        ${streamHtml}
                    </div>
                </div>
                <span style="color: #fff; font-size: 11px;">${timeAgo}</span>
            </div>
        `;
    }).join('');

    activeUsersLog('renderOnlineUsers: Render complete');
}

// Setup function for admin panel - call in openAdminPanel()
async function setupOnlineUsersSection() {
    activeUsersLog('setupOnlineUsersSection() called');

    const toggle = document.getElementById('online-users-toggle');
    const content = document.getElementById('online-users-content');
    const arrow = document.getElementById('online-users-arrow');
    const countBadge = document.getElementById('online-users-count');

    if (!toggle || !content || !arrow) {
        activeUsersLog('setupOnlineUsersSection: Missing elements - toggle:', !!toggle, 'content:', !!content, 'arrow:', !!arrow);
        return;
    }

    activeUsersLog('setupOnlineUsersSection: All elements found');

    // Fetch count immediately (this populates the cache too)
    activeUsersLog('setupOnlineUsersSection: Fetching online user count...');
    try {
        const users = await updateOnlineBetterNowUsers();
        if (countBadge) {
            // Filter out current user for display
            const displayUsers = users.filter(u => {
                if (typeof currentUserId !== 'undefined' && currentUserId) {
                    return String(u.odiskd) !== String(currentUserId);
                }
                return true;
            });
            // Count only active users (watching a stream OR idle < 15 min)
            const activeCount = displayUsers.filter(user => {
                if (user.stream) return true;
                const now = Date.now();
                const idleTime = now - (user.lastStreamTime || user.lastSeen);
                return idleTime < 900000;
            }).length;
            countBadge.textContent = activeCount;
            activeUsersLog('setupOnlineUsersSection: Updated count badge to', activeCount, '(active) from', users.length, '(total)');
        }
    } catch (e) {
        console.error('[BetterNow ActiveUsers] setupOnlineUsersSection: Failed to fetch count:', e);
    }

    activeUsersLog('setupOnlineUsersSection: Attaching click handler');

    toggle.addEventListener('click', async () => {
        const isHidden = content.style.display === 'none';
        activeUsersLog('setupOnlineUsersSection: Toggle clicked, isHidden:', isHidden);

        content.style.display = isHidden ? 'block' : 'none';
        arrow.textContent = isHidden ? '▼' : '▶';

        if (isHidden) {
            activeUsersLog('setupOnlineUsersSection: Section opened, rendering from cache');
            // Use cached data - don't refetch
            await renderOnlineUsers(false);

            // Auto-refresh every 30 seconds while open
            activeUsersLog('setupOnlineUsersSection: Starting auto-refresh interval (30s)');
            onlineUsersRefreshInterval = setInterval(() => {
                activeUsersLog('setupOnlineUsersSection: Auto-refresh tick');
                renderOnlineUsers(true); // Force refresh on heartbeat
            }, 30000);
        } else {
            // Stop auto-refresh when closed
            activeUsersLog('setupOnlineUsersSection: Section closed, stopping auto-refresh');
            if (onlineUsersRefreshInterval) {
                clearInterval(onlineUsersRefreshInterval);
                onlineUsersRefreshInterval = null;
            }
        }
    });

    // Refresh button - force refresh
    const refreshBtn = document.getElementById('refresh-online-users');
    if (refreshBtn) {
        activeUsersLog('setupOnlineUsersSection: Attaching refresh button handler');
        refreshBtn.addEventListener('click', async () => {
            activeUsersLog('setupOnlineUsersSection: Refresh button clicked');
            refreshBtn.textContent = 'Refreshing...';
            await renderOnlineUsers(true); // Force refresh
            refreshBtn.textContent = 'Refresh';
        });
    }

    activeUsersLog('setupOnlineUsersSection: Setup complete');
}

// Clean up on admin panel close
function cleanupOnlineUsersSection() {
    activeUsersLog('cleanupOnlineUsersSection() called');
    if (onlineUsersRefreshInterval) {
        activeUsersLog('cleanupOnlineUsersSection: Clearing refresh interval');
        clearInterval(onlineUsersRefreshInterval);
        onlineUsersRefreshInterval = null;
    }
    // Clear cache when panel closes so next open gets fresh data
    cachedOnlineUsers = null;
    onlineUsersCacheTime = 0;
    activeUsersLog('cleanupOnlineUsersSection: Cache cleared');
}

// ============ Initialization ============

// Initialize active users tracking
async function initActiveUsers() {
    activeUsersLog('initActiveUsers: Starting...');

    // Initial fetch of online users
    await updateOnlineBetterNowUsers();

    // Refresh online users list periodically (every 5 minutes)
    setInterval(async () => {
        activeUsersLog('initActiveUsers: 5m refresh tick');
        await updateOnlineBetterNowUsers();
    }, 300000);

    activeUsersLog('initActiveUsers: Complete');
}

// Wait for presence system to be ready, then initialize
function waitForPresenceThenInit() {
    activeUsersLog('waitForPresenceThenInit: Waiting for fetchOnlineUsers and presenceReady...');
    let attempts = 0;
    const maxAttempts = 60; // 30 seconds max

    const checkInterval = setInterval(() => {
        attempts++;

        // Check if presence system is available AND first presence write is done
        const hasFetchFunction = typeof fetchOnlineUsers === 'function';
        const presenceReady = window.presenceReady === true;

        if (hasFetchFunction && presenceReady) {
            activeUsersLog('waitForPresenceThenInit: Ready after', attempts, 'attempts (fetchOnlineUsers:', hasFetchFunction, ', presenceReady:', presenceReady, ')');
            clearInterval(checkInterval);
            initActiveUsers();
            return;
        }

        if (attempts % 10 === 0) {
            activeUsersLog('waitForPresenceThenInit: Still waiting... attempt', attempts, '(fetchOnlineUsers:', hasFetchFunction, ', presenceReady:', presenceReady, ')');
        }

        // Timeout
        if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            console.warn('[BetterNow ActiveUsers] Presence system not ready after 30s, badges disabled');
        }
    }, 500);
}

// Start initialization
waitForPresenceThenInit();