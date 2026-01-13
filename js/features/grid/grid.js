// ============ Grid View ============
// Toggle grid layout for multiple video streams

// Class name for grid view (unique to avoid conflicts with YouNow's classes)
const GRID_CLASS = 'betternow-grid-active';

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
    // Always read from localStorage as the source of truth
    const isEnabled = localStorage.getItem('betternow-grid-view') === 'true';
    const videoCount = getVideoCount();

    // Only apply grid view if enabled AND 2+ videos
    if (isEnabled && videoCount >= 2) {
        document.body.classList.add(GRID_CLASS);
    } else {
        document.body.classList.remove(GRID_CLASS);
    }
}

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