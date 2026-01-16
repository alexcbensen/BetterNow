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

    // Helper: calculate idle time for a user
    const getIdleTime = (user) => Date.now() - (user.lastStreamTime || user.lastSeen);

    // Helper: check if user was active in the last 10 minutes
    const isRecentlyActive = (user) => getIdleTime(user) < 600000;

    // Helper: check if user is broadcasting (watching themselves AND recently active)
    const isLive = (user) => {
        return user.stream &&
            user.stream.toLowerCase() === user.username.toLowerCase() &&
            isRecentlyActive(user);
    };

    // Helper: check if we should show "watching" for a user
    // Returns false if we have fresh data showing the broadcaster is NOT live
    const shouldShowWatching = (user) => {
        if (!user.stream || !isRecentlyActive(user)) return false;

        // If watching themselves, that's handled by isLive()
        if (user.stream.toLowerCase() === user.username.toLowerCase()) return false;

        // Look up the broadcaster in our list
        const broadcaster = displayUsers.find(u =>
            u.username.toLowerCase() === user.stream.toLowerCase()
        );

        // If broadcaster is in our list with recent data, check if they're actually live
        if (broadcaster && isRecentlyActive(broadcaster)) {
            // We have fresh data - only show "watching" if they're live
            return isLive(broadcaster);
        }

        // Broadcaster not in list or data is stale - trust the viewer's heartbeat
        return true;
    };

    // Count only active users (live, watching a live stream, OR idle < 10 min)
    const activeUsers = displayUsers.filter(user => {
        if (isLive(user)) return true;
        if (shouldShowWatching(user)) return true;
        return isRecentlyActive(user);
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

    // Split users into online (<1 hour) and offline (1+ hours)
    const onlineUsers = displayUsers.filter(user => getIdleTime(user) < 3600000);
    const offlineUsers = displayUsers.filter(user => getIdleTime(user) >= 3600000);

    // Sort online users: live first, then watching, then by most recent activity
    const sortedOnlineUsers = [...onlineUsers].sort((a, b) => {
        const aLive = isLive(a);
        const bLive = isLive(b);
        // Live broadcasters first
        if (aLive && !bLive) return -1;
        if (!aLive && bLive) return 1;
        // Then users actively watching a live stream
        const aWatching = shouldShowWatching(a);
        const bWatching = shouldShowWatching(b);
        if (aWatching && !bWatching) return -1;
        if (!aWatching && bWatching) return 1;
        // Then sort by most recently seen
        return getIdleTime(a) - getIdleTime(b);
    });

    // Sort offline users by most recently seen (least idle first)
    const sortedOfflineUsers = [...offlineUsers].sort((a, b) => {
        return getIdleTime(a) - getIdleTime(b);
    });

    // Helper: check if we should show the right-side timestamp
    // Only show for users we're actively monitoring (live, watching, or recently active)
    const shouldShowTimestamp = (user) => {
        return isLive(user) || shouldShowWatching(user) || isRecentlyActive(user);
    };

    // Helper: render a single user row
    const renderUserRow = (user, isOffline = false) => {
        const idleTime = getIdleTime(user);

        // Show "LIVE" badge if broadcasting, otherwise show stream info or idle status
        let streamHtml = '';
        if (isLive(user)) {
            streamHtml = `<a href="/${user.username}" style="
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
        } else if (shouldShowWatching(user)) {
            // Show "watching/guesting" - broadcaster is verified live
            const action = user.isGuesting ? 'guesting' : 'watching';
            streamHtml = `<span style="color: #888; font-size: 12px;">${action} </span><a href="/${user.stream}" style="color: #888; font-size: 12px; text-decoration: none;">${user.stream}</a>`;
        } else if (isOffline) {
            // Offline users (1+ hours) - "last online Xh ago"
            const hours = Math.floor(idleTime / 3600000);
            streamHtml = `<span style="color: #666; font-size: 12px;">last online ${hours}h ago</span>`;
        } else if (idleTime >= 600000) {
            // Idle 10-60 min - show actual minutes
            const minutes = Math.floor(idleTime / 60000);
            streamHtml = `<span style="color: #888; font-size: 12px;">last seen ${minutes}m ago</span>`;
        } else {
            // Idle < 10 min - "online"
            streamHtml = `<span style="color: #888; font-size: 12px;">online</span>`;
        }

        // Only show timestamp for users we're actively monitoring (not offline)
        const timeAgoHtml = !isOffline && shouldShowTimestamp(user)
            ? `<span style="color: #888; font-size: 11px;">${getTimeAgo(user.lastSeen)}</span>`
            : '';

        // Online indicator dot - green for online, gray for offline
        const dotColor = isOffline ? '#666' : '#08d687';

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
                            background: ${dotColor};
                            border-radius: 50%;
                            border: 2px solid #2a2a2a;
                        "></div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                        <span style="color: #fff; font-size: 14px;">${user.username}</span>
                        ${streamHtml}
                    </div>
                </div>
                ${timeAgoHtml}
            </div>
        `;
    };

    // Build HTML with separate sections
    let html = '';

    // Online Users section
    if (sortedOnlineUsers.length > 0) {
        html += sortedOnlineUsers.map(user => renderUserRow(user, false)).join('');
    } else {
        html += '<p style="color: #888; font-size: 13px; margin-bottom: 12px;">No users currently online</p>';
    }

    // Offline Users section (collapsible)
    if (sortedOfflineUsers.length > 0) {
        html += `
            <div style="margin-top: 16px; border-top: 1px solid #444; padding-top: 12px;">
                <div id="offline-users-toggle" style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
                    <span id="offline-users-arrow" style="color: #888; font-size: 10px;">▶</span>
                    <span style="color: #888; font-size: 12px; font-weight: 600;">Offline Users</span>
                </div>
                <div id="offline-users-list" style="display: none;">
                    ${sortedOfflineUsers.map(user => renderUserRow(user, true)).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;

    // Add toggle handler for offline section
    const offlineToggle = container.querySelector('#offline-users-toggle');
    const offlineList = container.querySelector('#offline-users-list');
    const offlineArrow = container.querySelector('#offline-users-arrow');
    if (offlineToggle && offlineList && offlineArrow) {
        offlineToggle.addEventListener('click', () => {
            const isHidden = offlineList.style.display === 'none';
            offlineList.style.display = isHidden ? 'block' : 'none';
            offlineArrow.textContent = isHidden ? '▼' : '▶';
        });
    }

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
        // renderOnlineUsers handles both fetching and count badge update
        await renderOnlineUsers(true);
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