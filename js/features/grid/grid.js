// ============ Grid View ============
// Toggle grid layout for multiple video streams

const GRID_DEBUG = false; // Set to false before release

function gridLog(...args) {
    if (GRID_DEBUG) {
        console.log('[BetterNow Grid]', new Date().toISOString().substr(11, 12), ...args);
    }
}

// Use getter function instead of variable - localStorage is source of truth
function isGridViewEnabled() {
    return localStorage.getItem('betternow-grid-view') === 'true';
}

// For backwards compatibility with features.js toggle button
// This getter/setter keeps the global in sync with localStorage
Object.defineProperty(window, 'gridViewEnabled', {
    get() {
        return isGridViewEnabled();
    },
    set(value) {
        localStorage.setItem('betternow-grid-view', value.toString());
        gridLog('gridViewEnabled set to:', value);
    }
});

gridLog('Initial state from localStorage:', isGridViewEnabled());

function getVideoCount() {
    // Only count video tiles that have an active video or audio stream
    return document.querySelectorAll('.fullscreen-wrapper > .video:has(video.is-active), .fullscreen-wrapper > .video:has(.audio.is-active)').length;
}

// Get broadcaster username from URL
function getBroadcasterUsername() {
    const path = window.location.pathname;
    const match = path.match(/^\/([^\/]+)/);
    if (!match) return null;
    const username = match[1].toLowerCase();
    // Exclude non-stream pages
    if (['explore', 'moments', 'settings', 'inbox', ''].includes(username)) {
        return null;
    }
    return username;
}

// Mark the broadcaster's video tile for CSS targeting
function markBroadcasterTile() {
    const broadcasterUsername = getBroadcasterUsername();
    if (!broadcasterUsername) return;

    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');

    videoTiles.forEach(tile => {
        // Check if this tile's video has a data-betternow-label containing the broadcaster's username
        const video = tile.querySelector('video[data-betternow-label]');
        if (video) {
            const label = video.getAttribute('data-betternow-label').toLowerCase();
            // Label format is like "guest-username-video0" or "broadcaster-username-video0"
            if (label.includes(broadcasterUsername)) {
                tile.setAttribute('data-betternow-broadcaster', 'true');
                gridLog('Marked broadcaster tile:', broadcasterUsername);
            } else {
                tile.removeAttribute('data-betternow-broadcaster');
            }
        } else {
            // Fallback: check the username in the toolbar overlay
            const usernameEl = tile.querySelector('.toolbar--overlay .username');
            if (usernameEl) {
                const tileUsername = usernameEl.textContent.trim().toLowerCase();
                if (tileUsername === broadcasterUsername) {
                    tile.setAttribute('data-betternow-broadcaster', 'true');
                    gridLog('Marked broadcaster tile (via toolbar):', broadcasterUsername);
                } else {
                    tile.removeAttribute('data-betternow-broadcaster');
                }
            }
        }
    });
}

function createGridToggle() {
    // Grid toggle is now in the BetterNow toolbar
    // This function just applies the grid view state
    gridLog('createGridToggle called');
    applyGridView();
}

function applyGridView() {
    const enabled = isGridViewEnabled();
    const videoCount = getVideoCount();
    const shouldBeActive = enabled && videoCount >= 2;
    const isActive = document.body.classList.contains('betternow-grid-active');

    // Skip if state hasn't changed
    if (shouldBeActive === isActive) return;

    // Don't remove the class if we're still waiting for videos to load
    // This preserves the early activation until we know the actual video count
    if (enabled && videoCount === 0 && isActive) {
        gridLog('applyGridView - waiting for videos, keeping class');
        return;
    }

    gridLog('applyGridView - enabled:', enabled, 'videoCount:', videoCount);

    if (shouldBeActive) {
        gridLog('Adding betternow-grid-active class');
        document.body.classList.add('betternow-grid-active');
        // Mark broadcaster's tile for notification positioning
        markBroadcasterTile();
    } else {
        gridLog('Removing betternow-grid-active class');
        document.body.classList.remove('betternow-grid-active');
    }
}

function checkPortraitVideo(video) {
    if (video.videoWidth && video.videoHeight) {
        const isPortrait = video.videoHeight > video.videoWidth;
        video.classList.toggle('is-portrait', isPortrait);
        gridLog('Portrait check:', video.videoWidth, 'x', video.videoHeight, '→', isPortrait ? 'portrait' : 'landscape');
    }
}

function fixVideoFit() {
    const isGridView = document.body.classList.contains('betternow-grid-active');
    const allVideos = document.querySelectorAll('.video-player video');
    gridLog('fixVideoFit - isGridView:', isGridView, 'videoCount:', allVideos.length);

    allVideos.forEach(video => {
        const videoTile = video.closest('.video');

        if (video.classList.contains('is-screenshare')) {
            // Screenshare: show full content
            video.style.objectFit = 'contain';
        } else {
            // Detect portrait (mobile) streams and use contain to avoid extreme zoom
            checkPortraitVideo(video);
            if (video.classList.contains('is-portrait')) {
                video.style.objectFit = 'contain';
            } else {
                // Landscape video: fill the frame (may crop edges)
                video.style.objectFit = 'cover';
            }

            // Re-check when video dimensions become available or change
            if (!video._betternowPortraitListener) {
                video.addEventListener('loadedmetadata', () => checkPortraitVideo(video));
                video.addEventListener('resize', () => checkPortraitVideo(video));
                video._betternowPortraitListener = true;
            }
        }

        // Clear any custom aspect ratio
        if (videoTile) {
            videoTile.style.aspectRatio = '';
        }
    });
}

// ============ Early Grid Activation ============
// Apply grid view class immediately on script load, before waiting for user detection.
// This eliminates the delay when joining a stream with grid view enabled.
// The CSS will apply as soon as videos render - no need to wait for currentUserId.
(function initGridViewEarly() {
    if (isGridViewEnabled()) {
        document.body.classList.add('betternow-grid-active');
        gridLog('Early grid activation applied');
    }
})();