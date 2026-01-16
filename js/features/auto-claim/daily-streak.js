/*
 * Alex's BetterNow - Daily Streak Auto-Claim
 * Automatically claims the daily bonus streak reward when the modal appears
 * 
 * Modal structure:
 *   modal-container.modal.show (display: block)
 *     .modal-dialog.modal-dialog-centered.streak
 *       .modal-content
 *         app-modal-streak
 *           .streak-content
 *             .modal-body
 *               h3.gray-title "My Bonus Streak"
 *               app-day (shows streak count with animation)
 *               .prize-wrapper (shows pearl reward + multiplier)
 *               button.button.button--green "Claim"
 * 
 * Backdrop: bs-modal-backdrop.modal-backdrop.fade.in.show
 * Animation JSON: https://ynassets.younow.com/yn-web/live/assets/animations/streak-explosion.json
 */

// ============ Debug Configuration ============
const STREAK_DEBUG = false;

function streakLog(...args) {
    if (STREAK_DEBUG) {
        console.log('[BetterNow Streak]', new Date().toISOString().substr(11, 12), ...args);
    }
}

function streakWarn(...args) {
    console.warn('[BetterNow Streak]', ...args);
}

// ============ State ============
let streakObserver = null;
let hasClaimedThisSession = false;

// ============ Detection Functions ============

/**
 * Check if the streak modal is currently visible
 * Modal structure: modal-container.modal.show > .modal-dialog.streak
 */
function isStreakModalVisible() {
    const modal = document.querySelector('modal-container.modal.show .modal-dialog.streak');
    return modal !== null;
}

/**
 * Get the Claim button from the streak modal
 */
function getStreakClaimButton() {
    return document.querySelector('.modal-dialog.streak .button.button--green');
}

/**
 * Get streak info from the modal for logging
 */
function getStreakInfo() {
    const modal = document.querySelector('.modal-dialog.streak');
    if (!modal) return null;
    
    // Get day count (the second .number span contains the new day count)
    const dayNumbers = modal.querySelectorAll('app-day .number');
    const dayCount = dayNumbers.length >= 2 ? dayNumbers[1]?.textContent : dayNumbers[0]?.textContent;
    
    // Get pearl reward
    const pearlsEl = modal.querySelector('.pearls');
    const pearls = pearlsEl ? pearlsEl.textContent.trim() : 'unknown';
    
    // Get props multiplier
    const multiplierEl = modal.querySelector('.props-multiplier');
    const multiplier = multiplierEl ? multiplierEl.textContent.trim() : '';
    
    return {
        day: dayCount,
        pearls: pearls,
        multiplier: multiplier
    };
}

// ============ Auto-Claim Logic ============

/**
 * Attempt to claim the daily streak reward
 */
function claimDailyStreak() {
    if (hasClaimedThisSession) {
        streakLog('Already claimed this session, skipping');
        return;
    }
    
    const claimButton = getStreakClaimButton();
    if (!claimButton) {
        streakWarn('Claim button not found');
        return;
    }
    
    const info = getStreakInfo();
    streakLog('Claiming daily streak:', info);
    
    // Click the claim button immediately
    claimButton.click();
    hasClaimedThisSession = true;
    
    streakLog('Daily streak claimed!', info ? `Day ${info.day}, ${info.pearls}` : '');
}

/**
 * Handle when streak modal appears
 */
function onStreakModalAppear() {
    // Don't auto-claim if extension is disabled for blocked users
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) {
        streakLog('Extension disabled, skipping auto-claim');
        return;
    }
    
    streakLog('Streak modal detected');
    
    // Claim immediately
    if (isStreakModalVisible()) {
        claimDailyStreak();
    }
}

// ============ Observer Setup ============

/**
 * Set up observer to watch for streak modal appearing
 */
function setupStreakObserver() {
    if (streakObserver) {
        streakLog('Observer already running');
        return;
    }
    
    streakLog('Setting up streak modal observer');
    
    streakObserver = new MutationObserver((mutations) => {
        // Check if streak modal just appeared
        if (isStreakModalVisible() && !hasClaimedThisSession) {
            onStreakModalAppear();
        }
    });
    
    streakObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Also check immediately in case modal is already visible
    if (isStreakModalVisible() && !hasClaimedThisSession) {
        onStreakModalAppear();
    }
}

/**
 * Stop the streak observer
 */
function stopStreakObserver() {
    if (streakObserver) {
        streakObserver.disconnect();
        streakObserver = null;
        streakLog('Observer stopped');
    }
}

// ============ Initialization ============

/**
 * Initialize the daily streak auto-claim feature
 */
function initDailyStreakAutoClaim() {
    // Wait for blocked user check to complete
    if (typeof blockedCheckComplete !== 'undefined' && !blockedCheckComplete) {
        const checkInterval = setInterval(() => {
            if (blockedCheckComplete) {
                clearInterval(checkInterval);
                if (typeof extensionDisabled !== 'undefined' && extensionDisabled) {
                    streakLog('Extension disabled for blocked user, not initializing');
                    return;
                }
                setupStreakObserver();
            }
        }, 50);
        return;
    }
    
    // Check if extension is disabled
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) {
        streakLog('Extension disabled for blocked user, not initializing');
        return;
    }
    
    setupStreakObserver();
}

// Start on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDailyStreakAutoClaim);
} else {
    initDailyStreakAutoClaim();
}

// ============ Debug Helpers ============

window.debugStreak = function() {
    console.log('[BetterNow Streak] Debug info:');
    console.log('  Modal visible:', isStreakModalVisible());
    console.log('  Claimed this session:', hasClaimedThisSession);
    console.log('  Observer active:', streakObserver !== null);
    console.log('  Streak info:', getStreakInfo());
    return {
        modalVisible: isStreakModalVisible(),
        claimed: hasClaimedThisSession,
        observerActive: streakObserver !== null,
        info: getStreakInfo()
    };
};

// Manually trigger claim (for testing)
window.claimStreakNow = function() {
    console.log('[BetterNow Streak] Manual claim triggered');
    hasClaimedThisSession = false; // Reset so we can claim again
    if (isStreakModalVisible()) {
        claimDailyStreak();
    } else {
        console.log('[BetterNow Streak] No streak modal visible');
    }
};

streakLog('Daily streak module initialized');
