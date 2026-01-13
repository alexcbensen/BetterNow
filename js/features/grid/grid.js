// ============ Grid View ============
// Toggle grid layout for multiple video streams
// Empty slot hiding is handled by CSS - slots auto-show when they become active

// Debug logging - set to true for debugging
const GRID_DEBUG = false;

function gridLog(...args) {
    if (GRID_DEBUG) {
        console.log('[BetterNow Grid]', ...args);
    }
}

let gridViewEnabled = localStorage.getItem('betternow-grid-view') === 'true';

function getVideoCount() {
    // Count video tiles that are NOT placeholders (actual active streams)
    const count = document.querySelectorAll('.fullscreen-wrapper > .video:not(.video--placeholder)').length;
    gridLog('getVideoCount:', count);
    return count;
}

function createGridToggle() {
    // Grid toggle is now in the BetterNow toolbar
    // This function just applies the grid view state
    applyGridView();
}

function applyGridView() {
    const videoCount = getVideoCount();

    gridLog('applyGridView: videoCount=', videoCount, 'gridViewEnabled=', gridViewEnabled);

    // Only apply grid view if enabled AND 2+ videos
    if (gridViewEnabled && videoCount >= 2) {
        document.body.classList.add('grid-view-enabled');

        // Hide empty slots only when exactly 2 active streams
        if (videoCount === 2) {
            document.body.classList.add('grid-hide-empty');
            gridLog('applyGridView: Hiding empty slots (2 streams)');

            // Auto-enable sticky header for 2-person stacked mode (need vertical space)
            enableStickyHeaderForStackedMode(true);

            // Create fixed sidebar for 2-person mode
            createFixedSidebar();
        } else {
            document.body.classList.remove('grid-hide-empty');
            gridLog('applyGridView: Showing all slots (3+ streams)');

            // Restore user's sticky header preference
            enableStickyHeaderForStackedMode(false);

            // Remove fixed sidebar when not in 2-person mode
            removeFixedSidebar();
        }
    } else {
        document.body.classList.remove('grid-view-enabled');
        document.body.classList.remove('grid-hide-empty');
        gridLog('applyGridView: Grid view disabled');

        // Restore user's sticky header preference
        enableStickyHeaderForStackedMode(false);

        // Remove fixed sidebar when grid view is disabled
        removeFixedSidebar();
    }
}

// ============ Fixed Sidebar for 2-Person Mode ============
// Clones the profile sidebar (.left) to a fixed position container

let fixedSidebarCreated = false;

function createFixedSidebar() {
    // Don't create if already exists
    if (document.getElementById('betternow-fixed-sidebar')) {
        gridLog('createFixedSidebar: Already exists');
        return;
    }

    // Find the source sidebar
    const sourceSidebar = document.querySelector('app-channel-profile .columns > .left');
    if (!sourceSidebar) {
        gridLog('createFixedSidebar: Source sidebar not found, will retry');
        // Retry after delay - profile might not be loaded yet
        setTimeout(createFixedSidebar, 500);
        return;
    }

    gridLog('createFixedSidebar: Creating fixed sidebar');

    // Create fixed container
    const fixedSidebar = document.createElement('div');
    fixedSidebar.id = 'betternow-fixed-sidebar';

    // Clone the sidebar content
    fixedSidebar.innerHTML = sourceSidebar.innerHTML;

    // Append to body so it's outside Angular's scope
    document.body.appendChild(fixedSidebar);

    fixedSidebarCreated = true;
    gridLog('createFixedSidebar: Fixed sidebar created');
}

function removeFixedSidebar() {
    const fixedSidebar = document.getElementById('betternow-fixed-sidebar');
    if (fixedSidebar) {
        fixedSidebar.remove();
        fixedSidebarCreated = false;
        gridLog('removeFixedSidebar: Fixed sidebar removed');
    }
}

// Track if we forced sticky header on
let forcedStickyHeader = false;

function enableStickyHeaderForStackedMode(enable) {
    const header = document.querySelector('app-channel .header');
    const stickyBtn = document.getElementById('betternow-css-toggle');

    if (!header) return;

    if (enable) {
        // Force sticky header OFF (scrolling/relative) for more vertical space
        header.style.setProperty('position', 'relative', 'important');
        header.style.setProperty('top', '0', 'important');

        if (stickyBtn) {
            stickyBtn.style.background = 'var(--color-mediumgray, #888)';
        }

        forcedStickyHeader = true;
        gridLog('enableStickyHeaderForStackedMode: Forced sticky header OFF (scrolling)');
    } else if (forcedStickyHeader) {
        // Restore user's preference (headerCssEnabled from features.js)
        const userPrefersScrolling = typeof headerCssEnabled !== 'undefined' ? headerCssEnabled :
            localStorage.getItem('betternow-sticky-header-disabled') !== 'false';

        if (userPrefersScrolling) {
            // User prefers scrolling (non-sticky) header
            header.style.setProperty('position', 'relative', 'important');
            header.style.setProperty('top', '0', 'important');
            if (stickyBtn) {
                stickyBtn.style.background = 'var(--color-mediumgray, #888)';
            }
        } else {
            // User prefers sticky header
            header.style.setProperty('position', 'sticky', 'important');
            header.style.setProperty('top', 'var(--topbar-height)', 'important');
            if (stickyBtn) {
                stickyBtn.style.background = 'var(--color-primary-green, #08d687)';
            }
        }

        forcedStickyHeader = false;
        gridLog('enableStickyHeaderForStackedMode: Restored user preference');
    }
}

// Observer placeholder for future grid view adjustments
const audioSmallObserver = new MutationObserver((mutations) => {
    // Currently disabled
});
audioSmallObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

// Observer to watch for video streams becoming active/inactive
let gridStreamObserver = null;

function setupGridStreamObserver() {
    const fullscreenWrapper = document.querySelector('.fullscreen-wrapper');
    if (!fullscreenWrapper || gridStreamObserver) return;

    gridLog('setupGridStreamObserver: Setting up observer');

    gridStreamObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;

        for (const mutation of mutations) {
            // Check for class changes (video--placeholder being added/removed)
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                // Video tile class changed (placeholder status might have changed)
                if (target.classList?.contains('video')) {
                    shouldUpdate = true;
                    gridLog('setupGridStreamObserver: Detected class change on video tile');
                    break;
                }
            }

            // Check for video tiles being added/removed
            if (mutation.type === 'childList') {
                const hasVideoChange = Array.from(mutation.addedNodes).some(node =>
                    node.nodeType === 1 && node.classList?.contains('video')
                ) || Array.from(mutation.removedNodes).some(node =>
                    node.nodeType === 1 && node.classList?.contains('video')
                );

                if (hasVideoChange) {
                    shouldUpdate = true;
                    gridLog('setupGridStreamObserver: Detected video tile add/remove');
                    break;
                }
            }
        }

        if (shouldUpdate) {
            // Small delay to let DOM settle
            setTimeout(applyGridView, 50);
        }
    });

    gridStreamObserver.observe(fullscreenWrapper, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });

    gridLog('setupGridStreamObserver: Observer active');
}

// Initialize on page load
function initGrid() {
    gridLog('initGrid: Initializing');

    // Try to set up observer immediately
    setupGridStreamObserver();

    // Also watch for fullscreen-wrapper to appear if not present yet
    if (!document.querySelector('.fullscreen-wrapper')) {
        gridLog('initGrid: fullscreen-wrapper not found, watching for it');
        const bodyObserver = new MutationObserver((mutations) => {
            if (document.querySelector('.fullscreen-wrapper')) {
                gridLog('initGrid: fullscreen-wrapper appeared');
                bodyObserver.disconnect();
                setupGridStreamObserver();
                applyGridView();
            }
        });
        bodyObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Apply grid view after a delay to let videos load
    setTimeout(applyGridView, 500);
    setTimeout(applyGridView, 1500);
}

// Run on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGrid);
} else {
    initGrid();
}

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