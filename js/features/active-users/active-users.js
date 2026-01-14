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

// ============ Core Functions ============

// Fetch online users and update caches
async function updateOnlineBetterNowUsers() {
    if (typeof fetchOnlineUsers !== 'function') {
        activeUsersLog('updateOnlineBetterNowUsers: fetchOnlineUsers not available');
        return [];
    }

    try {
        const users = await fetchOnlineUsers();

        // Update ID set for badge display (update both local and window reference)
        window.onlineBetterNowUserIds = new Set(users.map(u => String(u.odiskd)));
        onlineBetterNowUserIds = window.onlineBetterNowUserIds;

        // Update full cache for admin panel
        cachedOnlineUsers = users;
        onlineUsersCacheTime = Date.now();

        activeUsersLog('updateOnlineBetterNowUsers: Got', onlineBetterNowUserIds.size, 'online users:', [...onlineBetterNowUserIds]);

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

    // Update count badge (excluding self)
    if (countBadge) {
        countBadge.textContent = displayUsers.length;
        activeUsersLog('renderOnlineUsers: Updated count badge to', displayUsers.length);
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

    // Sort users: those watching a stream first, then those not in a stream
    const sortedUsers = [...displayUsers].sort((a, b) => {
        if (a.stream && !b.stream) return -1;
        if (!a.stream && b.stream) return 1;
        return 0;
    });

    // Render user list
    container.innerHTML = sortedUsers.map(user => {
        // Only show stream info if user is watching a stream
        const streamHtml = user.stream
            ? `<span style="color: #888; font-size: 12px;">watching </span><a href="/${user.stream}" target="_blank" style="color: #888; font-size: 12px; text-decoration: none;">${user.stream}</a>`
            : '';

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
                    <div style="display: flex; flex-direction: column;">
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
            // Filter out current user for display count
            const displayCount = users.filter(u => {
                if (typeof currentUserId !== 'undefined' && currentUserId) {
                    return String(u.odiskd) !== String(currentUserId);
                }
                return true;
            }).length;
            countBadge.textContent = displayCount;
            activeUsersLog('setupOnlineUsersSection: Updated count badge to', displayCount, '(filtered from', users.length, ')');
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