// ============ Explore / Hidden Broadcasters ============
// Carousel navigation and hidden broadcaster filtering on explore page

// Debug logging - set to true for verbose output
const EXPLORE_DEBUG = false;

function exploreLog(...args) {
    if (EXPLORE_DEBUG) {
        console.log('[BetterNow Explore]', ...args);
    }
}

let lastSkipTime = 0;
let lastDirection = 'next';
let carouselBroadcastMap = null; // Cache: broadcastId -> {userId, profile}
let carouselMapFetchTime = 0;
const CAROUSEL_MAP_CACHE_MS = 30000; // Refresh map every 30 seconds

// Store replacement data globally so it survives Angular re-renders
let carouselReplacements = {}; // broadcastId -> {replacementBroadcastId, replacementProfile, replacementUserId}

// Cache replacement assignments for hidden users (hiddenUserId -> replacement data)
let cachedReplacementsForHiddenUsers = {};

// Track which entries are hidden users (by position)
let hiddenUserPositions = new Set();

// Track blocked broadcast IDs (room IDs to block WebSocket connections)
let blockedBroadcastIds = new Set();

// Track which replacement users have been assigned (to avoid duplicates)
let usedReplacementUserIds = new Set();

// Deterministic hash for consistent replacement selection
// Same hidden user ID always maps to same index in available list
function getConsistentReplacement(hiddenUserId, availableUsers) {
    if (availableUsers.length === 0) return null;

    // Generate hash from hidden user's ID
    let hash = 0;
    for (let i = 0; i < hiddenUserId.length; i++) {
        hash = ((hash << 5) - hash) + hiddenUserId.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }

    const startIndex = Math.abs(hash) % availableUsers.length;

    // Try the hashed index first, then iterate through list to find unused replacement
    for (let offset = 0; offset < availableUsers.length; offset++) {
        const index = (startIndex + offset) % availableUsers.length;
        const candidate = availableUsers[index];

        if (!usedReplacementUserIds.has(String(candidate.userId))) {
            usedReplacementUserIds.add(String(candidate.userId));
            return candidate;
        }
    }

    // All replacements used, return null
    return null;
}

// Inject WebSocket blocker into page context
function injectWebSocketBlocker() {
    if (document.getElementById('betternow-ws-blocker')) return;

    const script = document.createElement('script');
    script.id = 'betternow-ws-blocker';
    script.src = chrome.runtime.getURL('js/features/explore/ws-blocker.js');
    script.onload = function() {
        exploreLog('WebSocket blocker script loaded');
    };
    (document.head || document.documentElement).appendChild(script);
}

// Block a room via postMessage to page context
function blockRoom(roomId) {
    window.postMessage({ type: 'BETTERNOW_BLOCK_ROOM', roomId: String(roomId) }, '*');
    blockedBroadcastIds.add(String(roomId));
    exploreLog('Requesting block for room:', roomId);
}

// Unblock a room via postMessage
function unblockRoom(roomId) {
    window.postMessage({ type: 'BETTERNOW_UNBLOCK_ROOM', roomId: String(roomId) }, '*');
    blockedBroadcastIds.delete(String(roomId));
}

// Call immediately
injectWebSocketBlocker();

// Pre-fetch and block hidden users' broadcast IDs as early as possible
async function preBlockHiddenUsers() {
    // Wait a moment for ws-blocker to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const response = await fetch('https://api.younow.com/php/api/younow/dashboard/locale=en/trending=50', {
            credentials: 'include'
        });
        const data = await response.json();
        const trendingUsers = data.trending_users || [];

        // Get current carousel broadcast IDs (if carousel exists)
        const carouselBroadcastIds = new Set();
        const carousel = document.querySelector('app-broadcasts-carousel');
        if (carousel) {
            carousel.querySelectorAll('img.thumbnail').forEach(img => {
                const match = img.src.match(/\/live\/(\d+)\//);
                if (match) carouselBroadcastIds.add(match[1]);
            });
        }

        // Find replacement users (not hidden, not in carousel)
        const replacements = trendingUsers.filter(u =>
            !hiddenUserIds.includes(String(u.userId)) &&
            !carouselBroadcastIds.has(String(u.broadcastId))
        );

        // Reset used replacements for this batch
        usedReplacementUserIds.clear();

        // Find hidden users and block their rooms
        for (const user of trendingUsers) {
            const userId = String(user.userId);
            if (hiddenUserIds.includes(userId)) {
                blockRoom(user.broadcastId);
                exploreLog('Pre-blocked room for hidden user:', user.profile, user.broadcastId);

                // Get a consistent replacement for this hidden user
                const replacement = getConsistentReplacement(userId, replacements);

                // Cache full replacement data for later use
                cachedReplacementsForHiddenUsers[userId] = {
                    originalBroadcastId: user.broadcastId,
                    broadcastId: replacement?.broadcastId,
                    profile: replacement?.profile,
                    userId: replacement ? String(replacement.userId) : null
                };
            }
        }
    } catch (e) {
        console.error('[BetterNow] Failed to pre-block hidden users:', e);
    }
}

// Run pre-blocking as early as possible
preBlockHiddenUsers();

// Hide carousel immediately on page load via CSS
function injectCarouselHideStyles() {
    if (document.getElementById('betternow-carousel-hide-styles')) return;

    const style = document.createElement('style');
    style.id = 'betternow-carousel-hide-styles';
    style.textContent = `
        app-broadcasts-carousel:not(.betternow-ready) {
            visibility: hidden !important;
        }
    `;
    document.head.appendChild(style);
}

// Call immediately to hide carousel before it renders
injectCarouselHideStyles();

// Show carousel after processing
function showCarousel() {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (carousel) {
        carousel.classList.add('betternow-ready');
    }
}

// Get the index of the currently active entry
function getActiveEntryIndex() {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (!carousel) return -1;

    const entries = carousel.querySelectorAll('.list__entry');
    for (let i = 0; i < entries.length; i++) {
        if (entries[i].querySelector('button.entry__button[disabled]')) {
            return i;
        }
    }
    return -1;
}

// Check if an entry at index is a hidden user
function isHiddenUserAtIndex(index) {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (!carousel) return false;

    const entries = carousel.querySelectorAll('.list__entry');
    if (index < 0 || index >= entries.length) return false;

    const entry = entries[index];

    // Check by thumbnail broadcast ID
    const thumb = entry.querySelector('img.thumbnail');
    if (thumb && thumb.src) {
        const match = thumb.src.match(/\/live\/(\d+)\//);
        if (match && carouselBroadcastMap) {
            const userInfo = carouselBroadcastMap[match[1]];
            if (userInfo && hiddenUserIds.includes(userInfo.userId)) {
                return true;
            }
        }
    }

    // Check by avatar (for entries that might not have thumbnail visible)
    const avatar = entry.querySelector('img.avatar');
    if (avatar && avatar.src) {
        const match = avatar.src.match(/\/user\/live\/(\d+)\//);
        if (match && hiddenUserIds.includes(match[1])) {
            return true;
        }
    }

    // Check if entry is marked as replaced (means it was a hidden user)
    if (entry.dataset.betternowReplaced === 'true') {
        return true;
    }

    return false;
}

// Intercept carousel button clicks to skip hidden users
// DISABLED - WebSocket blocker handles preventing stream load
// The skip happens in skipActiveHiddenUser() when hidden user becomes active
function setupCarouselInterceptor() {
    // Intentionally empty - keeping function to avoid errors
    // WebSocket blocking + skipActiveHiddenUser handles everything
}

// Fetch trending users and build broadcastId -> userId map
async function fetchCarouselBroadcastMap() {
    const now = Date.now();

    // Use cached map if fresh enough
    if (carouselBroadcastMap && (now - carouselMapFetchTime) < CAROUSEL_MAP_CACHE_MS) {
        return carouselBroadcastMap;
    }

    try {
        const response = await fetch('https://api.younow.com/php/api/younow/dashboard/locale=en/trending=50', {
            credentials: 'include'
        });
        const data = await response.json();

        carouselBroadcastMap = {};
        for (const user of data.trending_users || []) {
            carouselBroadcastMap[user.broadcastId] = {
                userId: String(user.userId),
                profile: user.profile || 'unknown'
            };
        }
        carouselMapFetchTime = now;

        return carouselBroadcastMap;
    } catch (e) {
        console.error('[BetterNow] Failed to fetch carousel broadcast map:', e);
        return carouselBroadcastMap || {};
    }
}

// Flag to prevent multiple simultaneous skips
let isCurrentlySkipping = false;
let lastSkipTimestamp = 0;
const SKIP_COOLDOWN_MS = 1500; // 1.5 second cooldown between skips

// Immediately skip active hidden user (synchronous - no API wait)
function skipActiveHiddenUser() {
    exploreLog('skipActiveHiddenUser called, isCurrentlySkipping:', isCurrentlySkipping);

    // Prevent multiple simultaneous skips
    if (isCurrentlySkipping) {
        exploreLog('BLOCKED - already skipping');
        return false;
    }

    // Cooldown check
    const now = Date.now();
    const timeSinceLastSkip = now - lastSkipTimestamp;
    if (timeSinceLastSkip < SKIP_COOLDOWN_MS) {
        exploreLog('BLOCKED - cooldown active, time since last:', timeSinceLastSkip);
        return false;
    }

    const carousel = document.querySelector('app-broadcasts-carousel');
    if (!carousel) {
        exploreLog('BLOCKED - no carousel');
        return false;
    }

    const activeEntry = carousel.querySelector('.list__entry:has(button.entry__button[disabled])');
    if (!activeEntry) {
        exploreLog('BLOCKED - no active entry');
        return false;
    }

    // Skip if already being handled
    if (activeEntry.dataset.betternowSkipping === 'true') {
        exploreLog('BLOCKED - entry already marked as skipping');
        return false;
    }

    // Check by avatar URL
    const avatar = activeEntry.querySelector('img.avatar');
    if (!avatar || !avatar.src) {
        exploreLog('BLOCKED - no avatar');
        return false;
    }

    const match = avatar.src.match(/\/user\/live\/(\d+)\//);
    if (!match) {
        exploreLog('BLOCKED - avatar URL no match');
        return false;
    }

    const userId = match[1];

    // Check if this is a hidden user
    if (!hiddenUserIds.includes(userId)) {
        exploreLog('BLOCKED - not a hidden user:', userId);
        return false;
    }

    exploreLog('>>> STARTING SKIP for hidden user:', userId);

    // Set global flag and timestamp IMMEDIATELY
    isCurrentlySkipping = true;
    lastSkipTimestamp = now;

    // Block their room if we have their broadcast ID cached
    const cached = cachedReplacementsForHiddenUsers[userId];
    if (cached && cached.originalBroadcastId) {
        blockRoom(cached.originalBroadcastId);
    }

    // Mark as skipping to prevent double-skip
    activeEntry.dataset.betternowSkipping = 'true';
    activeEntry.dataset.betternowHiddenUserId = userId;

    // Hide the ENTIRE wrapper inside the carousel entry - this hides everything
    const wrapper = activeEntry.querySelector('app-broadcasts-carousel-entry > .wrapper');
    if (wrapper) {
        wrapper.style.visibility = 'hidden';
    }

    // Store direction at time of skip to prevent issues
    const skipDirection = lastDirection;
    exploreLog('Direction:', skipDirection);

    // Small delay to let WebSocket blocking take effect, then skip
    setTimeout(() => {
        exploreLog('Executing click, isCurrentlySkipping:', isCurrentlySkipping);

        const btnClass = skipDirection === 'prev' ? '.button--prev' : '.button--next';
        const skipBtn = carousel.querySelector(btnClass);
        if (skipBtn) {
            exploreLog('Clicking', btnClass);
            carousel.dataset.betternowInitiatedClick = 'true';
            skipBtn.click();

            setTimeout(() => {
                carousel.dataset.betternowInitiatedClick = '';
            }, 50);

            // Poll for thumbnail to appear, then replace and show
            let attempts = 0;
            const checkThumbnail = () => {
                // Abort if another skip started
                if (activeEntry.dataset.betternowSkipping !== 'true') {
                    exploreLog('Poll aborted - skipping flag cleared');
                    return;
                }

                attempts++;
                const thumbnail = activeEntry.querySelector('img.thumbnail');

                if (thumbnail || attempts >= 15) {
                    // Replace thumbnail if it exists
                    if (thumbnail && cached && cached.broadcastId) {
                        const newThumbUrl = `https://ynassets.younow.com/broadcast/small/live/${cached.broadcastId}/${cached.broadcastId}.jpg`;
                        thumbnail.src = newThumbUrl;

                        activeEntry.dataset.betternowReplaced = 'true';

                        if (!thumbnail.dataset.betternowObserver) {
                            thumbnail.dataset.betternowObserver = 'true';
                            const thumbObserver = new MutationObserver(() => {
                                if (!thumbnail.src.includes(cached.broadcastId)) {
                                    thumbnail.src = newThumbUrl;
                                }
                            });
                            thumbObserver.observe(thumbnail, { attributes: true, attributeFilter: ['src'] });
                        }
                        exploreLog('Thumbnail replaced');
                    }

                    // Restore visibility
                    if (wrapper) wrapper.style.visibility = '';

                    exploreLog('>>> SKIP COMPLETE, clearing flags');
                    activeEntry.dataset.betternowSkipping = '';
                    isCurrentlySkipping = false;
                } else {
                    setTimeout(checkThumbnail, 20);
                }
            };
            checkThumbnail();
        } else {
            exploreLog('No skip button found!');
            isCurrentlySkipping = false;
        }
    }, 100);

    return true;
}

// Replace a hidden user's thumbnail with cached replacement data
function replaceHiddenUserThumbnail(entry, hiddenUserId) {
    // Find the thumbnail (it should exist now since entry is no longer active)
    const thumbnail = entry.querySelector('img.thumbnail');
    if (!thumbnail) return;

    // Look for cached replacement
    const cached = cachedReplacementsForHiddenUsers[hiddenUserId];
    if (!cached || !cached.broadcastId) return;

    // Check if thumbnail already shows the replacement (truly replaced)
    if (thumbnail.src.includes(cached.broadcastId)) return;

    // Verify this entry's thumbnail is actually the hidden user's broadcast
    const thumbMatch = thumbnail.src.match(/\/live\/(\d+)\//);
    if (!thumbMatch) return;

    // Store original for tracking
    const originalBroadcastId = thumbMatch[1];

    // Replace thumbnail
    const newThumbUrl = `https://ynassets.younow.com/broadcast/small/live/${cached.broadcastId}/${cached.broadcastId}.jpg`;
    thumbnail.src = newThumbUrl;

    // Mark entry as replaced
    entry.dataset.betternowReplaced = 'true';
    entry.dataset.betternowOriginalBroadcast = originalBroadcastId;
    entry.dataset.betternowReplacementBroadcast = cached.broadcastId;
    entry.dataset.betternowReplacementUser = cached.profile;

    // Store in global for click handling
    carouselReplacements[originalBroadcastId] = {
        originalUserId: hiddenUserId,
        replacementUserId: cached.userId,
        replacementProfile: cached.profile,
        replacementBroadcastId: cached.broadcastId
    };

    // Set up observer to keep thumbnail replaced
    if (!thumbnail.dataset.betternowObserver) {
        thumbnail.dataset.betternowObserver = 'true';
        const correctSrc = newThumbUrl;
        const thumbObserver = new MutationObserver(() => {
            if (thumbnail.src !== correctSrc && !thumbnail.src.includes(cached.broadcastId)) {
                thumbnail.src = correctSrc;
            }
        });
        thumbObserver.observe(thumbnail, { attributes: true, attributeFilter: ['src'] });
    }
}

// Hide carousel entries for hidden broadcasters (or replace with trending)
async function hideCarouselEntries() {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (!carousel) return;

    // Fetch fresh data (includes full trending list for replacements)
    let trendingUsers = [];
    try {
        const response = await fetch('https://api.younow.com/php/api/younow/dashboard/locale=en/trending=50', {
            credentials: 'include'
        });
        const data = await response.json();
        trendingUsers = data.trending_users || [];
    } catch (e) {
        console.error('[BetterNow] Failed to fetch trending users:', e);
        return;
    }

    // Build broadcast map and userId map
    const broadcastMap = {};
    const userIdMap = {}; // userId -> user data
    for (const user of trendingUsers) {
        broadcastMap[user.broadcastId] = {
            userId: String(user.userId),
            profile: user.profile || 'unknown'
        };
        userIdMap[String(user.userId)] = user;
    }

    if (Object.keys(broadcastMap).length === 0) return;

    // Get carousel broadcast IDs currently in use
    const carouselBroadcastIds = new Set();
    carousel.querySelectorAll('img.thumbnail').forEach(img => {
        const match = img.src.match(/\/live\/(\d+)\//);
        if (match) carouselBroadcastIds.add(match[1]);
    });

    // Find replacement users (not in carousel and not hidden)
    // Already sorted by trending - first ones are highest trending
    const replacements = trendingUsers.filter(u =>
        !carouselBroadcastIds.has(String(u.broadcastId)) &&
        !hiddenUserIds.includes(String(u.userId))
    );

    // Reset used replacements for this batch
    usedReplacementUserIds.clear();

    const entries = carousel.querySelectorAll('.list__entry');

    // First, check for active entry with hidden user (no thumbnail, but has avatar/username)
    entries.forEach(entry => {
        // Don't trigger additional skips if one is in progress
        if (isCurrentlySkipping) return;

        const isActive = entry.querySelector('button.entry__button[disabled]') !== null;
        if (!isActive) return;

        // Skip if already handled by skipActiveHiddenUser
        if (entry.dataset.betternowSkipping === 'true') return;

        const thumbnail = entry.querySelector('img.thumbnail');
        if (thumbnail && thumbnail.src && !thumbnail.src.includes('default')) return; // Has thumbnail, will be handled below

        // Active entry without thumbnail - check by avatar or username
        const avatar = entry.querySelector('img.avatar');
        const usernameEl = entry.querySelector('.username span') || entry.querySelector('h5.username');

        let userId = null;

        // Try to get userId from avatar URL
        if (avatar && avatar.src) {
            const match = avatar.src.match(/\/user\/live\/(\d+)\//);
            if (match) userId = match[1];
        }

        // Check if this is a hidden user
        if (userId && hiddenUserIds.includes(userId)) {
            // Mark that we're handling this skip to prevent double-skip
            entry.dataset.betternowSkipping = 'true';

            // Hide chat temporarily to prevent bleed
            const chatList = entry.querySelector('app-chat-list');
            if (chatList) chatList.style.visibility = 'hidden';

            // Skip in the same direction user was navigating
            const btnClass = lastDirection === 'prev' ? '.button--prev' : '.button--next';
            const skipBtn = carousel.querySelector(btnClass);
            if (skipBtn) {
                skipBtn.click();

                // Restore chat visibility and clear flag after skip
                setTimeout(() => {
                    if (chatList) chatList.style.visibility = '';
                    entry.dataset.betternowSkipping = '';
                }, 300);
            }
        }
    });

    // Then handle entries with thumbnails
    entries.forEach(entry => {
        const thumbnail = entry.querySelector('img.thumbnail');
        if (!thumbnail || thumbnail.src.includes('default_broadcast')) return;

        // Skip if already replaced
        if (entry.dataset.betternowReplaced === 'true') return;

        // Extract broadcast ID from thumbnail URL
        const match = thumbnail.src.match(/\/live\/(\d+)\//);
        if (!match) return;

        const broadcastId = match[1];
        const userInfo = broadcastMap[broadcastId];
        if (!userInfo) return;

        // Check if this user should be hidden
        const shouldHide = hiddenUserIds.some(hiddenId => {
            // Check if current user is an exception for this hidden broadcaster
            const exceptions = hiddenExceptions[hiddenId] || {};
            if (currentUserId && exceptions[currentUserId]) {
                return false; // Current user is exempt
            }
            return hiddenId === userInfo.userId;
        });

        if (shouldHide) {
            // Block WebSocket connections to this broadcast
            blockRoom(broadcastId);

            // Get a consistent replacement for this hidden user
            const replacement = getConsistentReplacement(userInfo.userId, replacements);

            if (replacement) {
                // Store replacement data globally (survives Angular re-renders)
                carouselReplacements[broadcastId] = {
                    replacementBroadcastId: replacement.broadcastId,
                    replacementProfile: replacement.profile,
                    replacementUserId: String(replacement.userId)
                };

                // Cache replacement for this hidden user (for use after skip)
                cachedReplacementsForHiddenUsers[userInfo.userId] = {
                    broadcastId: replacement.broadcastId,
                    profile: replacement.profile,
                    userId: String(replacement.userId),
                    originalBroadcastId: broadcastId  // Store original for blocking
                };

                // Update thumbnail
                const newThumbnailUrl = `https://ynassets.younow.com/broadcast/small/live/${replacement.broadcastId}/${replacement.broadcastId}.jpg`;
                thumbnail.src = newThumbnailUrl;

                // Store replacement data for click handling
                entry.dataset.betternowReplaced = 'true';
                entry.dataset.replacementUserId = replacement.userId;
                entry.dataset.replacementProfile = replacement.profile;
                entry.dataset.replacementBroadcastId = replacement.broadcastId;
                entry.dataset.originalBroadcastId = broadcastId;

                // Add aggressive observer to prevent YouNow from resetting thumbnail
                if (!thumbnail.dataset.betternowObserver) {
                    thumbnail.dataset.betternowObserver = 'true';
                    const correctSrc = newThumbnailUrl;
                    const thumbObserver = new MutationObserver(() => {
                        if (thumbnail.src !== correctSrc && !thumbnail.src.includes(replacement.broadcastId)) {
                            thumbnail.src = correctSrc;
                        }
                    });
                    thumbObserver.observe(thumbnail, { attributes: true, attributeFilter: ['src'] });
                }

                // Add to carousel set so we don't use this replacement again
                carouselBroadcastIds.add(String(replacement.broadcastId));

                // Ensure entry is visible
                entry.style.display = '';
            } else {
                // No replacement available, hide the entry
                entry.style.display = 'none';
            }
        } else {
            entry.style.display = ''; // Unhide if previously hidden
        }
    });

    // Set up click handlers for replaced entries
    setupReplacementClickHandlers(carousel);

    // Show carousel now that it's processed
    showCarousel();
}

// Handle clicks on replaced carousel entries - skip to next instead of loading hidden user
function setupReplacementClickHandlers(carousel) {
    const entries = carousel.querySelectorAll('.list__entry[data-betternow-replaced="true"]');

    entries.forEach(entry => {
        // Skip if handler already attached
        if (entry.dataset.betternowClickHandler === 'true') return;
        entry.dataset.betternowClickHandler = 'true';

        const button = entry.querySelector('button.entry__button');
        if (!button) return;

        // Capture click in capture phase (before YouNow's handler)
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Single skip to next entry
            const nextBtn = carousel.querySelector('.button--next');
            if (nextBtn) {
                nextBtn.click();
            }

            // Fix thumbnail after skip
            setTimeout(() => {
                reapplyReplacementThumbnails();
            }, 300);

            return false;
        }, true); // true = capture phase
    });
}

function hideNotifications() {
    // Hide notifications from hidden users
    hiddenUserIds.forEach(odiskd => {
        // Check if current user is an exception for this specific hidden broadcaster
        const exceptions = hiddenExceptions[odiskd] || {};
        if (currentUserId && exceptions[currentUserId]) {
            return;
        }

        const userData = hiddenUsers[odiskd] || {};
        const username = userData.username;

        if (username) {
            // Find notifications that mention this username
            document.querySelectorAll('.notifications-list app-notification').forEach(notification => {
                const usernameEl = notification.querySelector('.user-card__right b');
                if (usernameEl && usernameEl.textContent.trim().toLowerCase() === username.toLowerCase()) {
                    notification.style.display = 'none';
                }

                // Also hide notifications that mention the hidden user in the text
                const textEl = notification.querySelector('.user-card__right');
                if (textEl && textEl.textContent.toLowerCase().includes(username.toLowerCase())) {
                    notification.style.display = 'none';
                }
            });
        }

        // Also hide by avatar URL containing userId
        document.querySelectorAll(`.notifications-list app-notification img.avatar[src*="/${odiskd}/"]`).forEach(img => {
            const notification = img.closest('app-notification');
            if (notification) {
                notification.style.display = 'none';
            }
        });
    });
}

function hideBroadcasters() {
    hiddenUserIds.forEach(odiskd => {
        // Check if current user is an exception for this specific hidden broadcaster
        const exceptions = hiddenExceptions[odiskd] || {};
        if (currentUserId && exceptions[currentUserId]) {
            // Current user is exempt from seeing this hidden broadcaster hidden
            return;
        }

        const userData = hiddenUsers[odiskd] || {};
        const username = userData.username;

        // Hide by username link
        if (username) {
            document.querySelectorAll(`a[href="/${username}"]`).forEach(el => {
                const card = el.closest('li');
                if (card && !card.closest('app-broadcasts-carousel')) {
                    card.style.display = 'none';
                }
            });
        }

        // Hide streams where hidden user is guesting (by their avatar URL containing userId)
        document.querySelectorAll(`app-trending-user-guests img.avatar[src*="/${odiskd}/"]`).forEach(img => {
            const card = img.closest('app-trending-user');
            if (card) {
                const li = card.closest('li');
                if (li && !li.closest('app-broadcasts-carousel')) {
                    li.style.display = 'none';
                }
            }
        });
    });
}

function setupCarouselDirectionTracking() {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (!carousel || carousel.dataset.directionTracked) return;

    const prevBtn = carousel.querySelector('.button--prev');
    const nextBtn = carousel.querySelector('.button--next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (carousel.dataset.betternowInitiatedClick !== 'true') {
                lastDirection = 'prev';
            }
        }, true);
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (carousel.dataset.betternowInitiatedClick !== 'true') {
                lastDirection = 'next';
            }
        }, true);
    }

    carousel.dataset.directionTracked = 'true';
}

function hideCarouselBroadcasters() {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (!carousel) return;

    setupCarouselDirectionTracking();
    setupCarouselInterceptor();

    // Immediately skip if active entry is hidden (synchronous - no wait)
    skipActiveHiddenUser();

    // All hiding/replacement logic is now in hideCarouselEntries
    hideCarouselEntries();
}

// Re-apply replacement thumbnails that YouNow reset
function reapplyReplacementThumbnails() {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (!carousel) return;

    const entries = carousel.querySelectorAll('.list__entry');

    entries.forEach(entry => {
        const thumbnail = entry.querySelector('img.thumbnail');
        if (!thumbnail) return;

        const match = thumbnail.src.match(/\/live\/(\d+)\//);
        if (!match) return;

        const currentBroadcastId = match[1];

        // Check if this broadcast ID has a replacement
        const replacement = carouselReplacements[currentBroadcastId];
        if (replacement) {
            // Re-apply the replacement thumbnail
            const newSrc = `https://ynassets.younow.com/broadcast/small/live/${replacement.replacementBroadcastId}/${replacement.replacementBroadcastId}.jpg`;
            if (thumbnail.src !== newSrc) {
                thumbnail.src = newSrc;
            }

            // Re-apply dataset attributes
            entry.dataset.betternowReplaced = 'true';
            entry.dataset.replacementBroadcastId = replacement.replacementBroadcastId;
            entry.dataset.replacementProfile = replacement.replacementProfile;
            entry.dataset.replacementUserId = replacement.replacementUserId;

            // Ensure entry is visible
            entry.style.display = '';

            // Re-setup click handler
            setupReplacementClickHandlers(carousel);
        }
    });
}

// Observe carousel for changes and reapply hiding/replacements
function setupCarouselObserver() {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (!carousel || carousel.dataset.hideObserver) return;

    carousel.dataset.hideObserver = 'true';

    const observer = new MutationObserver(() => {
        if (isCurrentlySkipping) return;
        hideCarouselEntries();
        reapplyReplacementThumbnails();
    });

    observer.observe(carousel, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src'] // Watch for thumbnail src changes
    });
}

// Initialize carousel hiding when carousel appears
function initCarouselHiding() {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (carousel) {
        setupCarouselObserver();

        // Wait for Firebase data and thumbnails before processing
        waitForCarouselReady().then(() => {
            hideCarouselEntries();
        });

        // Fallback: show carousel after 3 seconds even if processing isn't complete
        setTimeout(showCarousel, 3000);
    }
}

// Wait for hiddenUserIds to be populated and carousel thumbnails to load
function waitForCarouselReady() {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 30; // 3 seconds max

        const check = () => {
            attempts++;

            // Check if Firebase data is loaded
            const hasHiddenUsers = typeof hiddenUserIds !== 'undefined' && hiddenUserIds.length > 0;

            // Check if carousel has thumbnails
            const carousel = document.querySelector('app-broadcasts-carousel');
            const thumbs = carousel?.querySelectorAll('img.thumbnail');
            const hasThumbsLoaded = thumbs && thumbs.length > 0 &&
                Array.from(thumbs).some(t => t.src && !t.src.includes('default'));

            if (hasHiddenUsers && hasThumbsLoaded) {
                resolve();
            } else if (attempts >= maxAttempts) {
                // Timeout - proceed anyway
                exploreLog('Carousel ready timeout - hiddenUsers:', hasHiddenUsers, 'thumbs:', hasThumbsLoaded);
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };

        check();
    });
}

// Run on page load and when DOM changes
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCarouselHiding);
} else {
    initCarouselHiding();
}