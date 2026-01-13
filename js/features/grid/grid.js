// ============ Grid View ============
// Toggle grid layout for multiple video streams

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
    const videoCount = getVideoCount();

    // Only apply grid view if enabled AND 2+ videos
    if (gridViewEnabled && videoCount >= 2) {
        document.body.classList.add('grid-view-enabled');
    } else {
        document.body.classList.remove('grid-view-enabled');
    }
}

// Observer placeholder for future grid view adjustments
const audioSmallObserver = new MutationObserver((mutations) => {
    // Currently disabled
});
audioSmallObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

function fixVideoFit() {
    const isGridView = document.body.classList.contains('grid-view-enabled');
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