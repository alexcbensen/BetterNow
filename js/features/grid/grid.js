// ============ Grid View ============
// Toggle grid layout for multiple video streams
// BUILD: 2026-01-13-GAMMA

// This log proves the NEW file loaded
console.log('%c[BetterNow] Grid.js BUILD 2026-01-13-GAMMA loaded!', 'background: #22c55e; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');

// NOTE: Using 'betternow-grid-active' instead of 'grid-view-enabled'
// because YouNow's Angular app has its own 'grid-view-enabled' class that conflicts!

const GRID_CLASS = 'betternow-grid-active';

let gridViewEnabled = localStorage.getItem('betternow-grid-view') === 'true';

function getVideoCount() {
    // Only count video tiles that have an active video or audio stream
    return document.querySelectorAll('.fullscreen-wrapper > .video:has(video.is-active), .fullscreen-wrapper > .video:has(.audio.is-active)').length;
}

function createGridToggle() {
    // Grid toggle is now in the BetterNow toolbar
    // This function just applies the grid view state
    applyGridView();
}

function applyGridView() {
    // ALWAYS read fresh from localStorage - don't trust the variable!
    const isEnabled = localStorage.getItem('betternow-grid-view') === 'true';
    const videoCount = getVideoCount();

    console.log('[BetterNow Grid] applyGridView:', { isEnabled, videoCount, shouldEnable: isEnabled && videoCount >= 2 });

    // Only apply grid view if enabled AND 2+ videos
    if (isEnabled && videoCount >= 2) {
        document.body.classList.add(GRID_CLASS);
    } else {
        document.body.classList.remove(GRID_CLASS);
    }
}

// Observer placeholder for future grid view adjustments
const audioSmallObserver = new MutationObserver((mutations) => {
    // Currently disabled
});
audioSmallObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

function fixVideoFit() {
    const isGridView = document.body.classList.contains(GRID_CLASS);
    const allVideos = document.querySelectorAll('.video-player video');

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