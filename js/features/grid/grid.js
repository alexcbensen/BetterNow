// ============ Grid View ============
// Toggle grid layout for multiple video streams

const GRID_DEBUG = true; // Set to false before release

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

    gridLog('applyGridView - enabled:', enabled, 'videoCount:', videoCount);

    if (shouldBeActive) {
        gridLog('Adding betternow-grid-active class');
        document.body.classList.add('betternow-grid-active');
    } else {
        gridLog('Removing betternow-grid-active class');
        document.body.classList.remove('betternow-grid-active');
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
            // Regular video: fill the frame (may crop edges)
            video.style.objectFit = 'cover';
        }

        // Clear any custom aspect ratio
        if (videoTile) {
            videoTile.style.aspectRatio = '';
        }
    });
}