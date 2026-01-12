// ============ Chest Auto-Drop ============
// Automatically opens treasure chest when like threshold is reached
// Uses audience list for accurate like tracking (not rounded toolbar values)

// Debug logging - set to false for production
const CHEST_DEBUG = false;

// ============ Notice Bar ============
// Displays chest progress to all BetterNow users watching the stream

function createNoticeBar() {
    if (document.getElementById('betternow-notice-bar')) return;

    const betternowToolbar = document.getElementById('betternow-toolbar');
    if (!betternowToolbar) return;

    const noticeBar = document.createElement('div');
    noticeBar.id = 'betternow-notice-bar';
    noticeBar.style.cssText = `
        display: none;
        align-items: center;
        justify-content: center;
        padding: 6px 12px;
        background: var(--background-color, #212121);
        border-bottom: 1px solid var(--main-border-color, #4e4e4e);
        font-size: 0.85rem;
        color: var(--color-text, #fff);
        font-family: inherit;
        gap: 8px;
    `;

    // Insert after BetterNow toolbar, before YouNow toolbar
    const youNowToolbar = document.querySelector('app-top-toolbar');
    if (youNowToolbar) {
        youNowToolbar.parentNode.insertBefore(noticeBar, youNowToolbar);
    }

    return noticeBar;
}

function updateNoticeBar() {
    let noticeBar = document.getElementById('betternow-notice-bar');

    // Only show if auto-chest is enabled and we have a threshold
    if (!autoChestEnabled || !autoChestThreshold || autoChestThreshold <= 0) {
        if (noticeBar) noticeBar.style.display = 'none';
        stopCooldownTimer();
        return;
    }

    // Create bar if it doesn't exist
    if (!noticeBar) {
        noticeBar = createNoticeBar();
        if (!noticeBar) return;
    }

    const currentLikes = getCurrentLikes();
    const likesInChest = Math.max(0, currentLikes - lastChestOpenLikes);
    const threshold = autoChestThreshold;
    const hasEnoughForNextDrop = likesInChest >= threshold;

    const now = Date.now();
    const cooldownRemaining = Math.max(0, chestDropCooldownUntil - now);

    let statusHtml = '';

    if (hasEnoughForNextDrop) {
        if (isChestAnimationPlaying) {
            // Animation is playing - show "Queued"
            statusHtml = `
                <span style="color: var(--color-mediumgray, #888);">|</span>
                <span style="color: var(--color-white, #fff);">
                    Queued
                </span>
            `;
        } else if (cooldownRemaining > 0) {
            // Animation done, show countdown
            const seconds = Math.ceil(cooldownRemaining / 1000);
            statusHtml = `
                <span style="color: var(--color-mediumgray, #888);">|</span>
                <span style="color: var(--color-white, #fff);">
                    Dropping in ${seconds}s
                </span>
            `;
            startCooldownTimer();
        } else {
            stopCooldownTimer();
        }
    } else {
        stopCooldownTimer();
    }

    noticeBar.innerHTML = `
        <span>Chest auto-drop enabled:</span>
        <span style="font-weight: 600;">
            ${likesInChest.toLocaleString()} / ${threshold.toLocaleString()} likes
        </span>
        ${statusHtml}
    `;

    noticeBar.style.display = 'flex';
}

// Cooldown timer interval
let cooldownTimerInterval = null;

function startCooldownTimer() {
    if (cooldownTimerInterval) return; // Already running

    cooldownTimerInterval = setInterval(() => {
        const now = Date.now();
        if (now >= chestDropCooldownUntil) {
            stopCooldownTimer();
            updateNoticeBar(); // Update to remove timer display
        } else {
            updateNoticeBar(); // Update countdown
        }
    }, 1000);
}

function stopCooldownTimer() {
    if (cooldownTimerInterval) {
        clearInterval(cooldownTimerInterval);
        cooldownTimerInterval = null;
    }
}

function hideNoticeBar() {
    const noticeBar = document.getElementById('betternow-notice-bar');
    if (noticeBar) {
        noticeBar.style.display = 'none';
    }
}

function removeNoticeBar() {
    const noticeBar = document.getElementById('betternow-notice-bar');
    if (noticeBar) {
        noticeBar.remove();
    }
}

function chestLog(...args) {
    if (CHEST_DEBUG) {
        console.log('[BetterNow Chest]', new Date().toISOString().substr(11, 12), ...args);
    }
}

function chestWarn(...args) {
    console.warn('[BetterNow Chest]', new Date().toISOString().substr(11, 12), ...args);
}

function chestError(...args) {
    console.error('[BetterNow Chest]', new Date().toISOString().substr(11, 12), ...args);
}

let chestObserver = null;
let audienceObserver = null;
let isOpeningChest = false;
let lastCheckedLikes = null;
let lastKnownAudienceLikes = null; // Track last total to avoid processing non-like changes
let chestOpenCount = 0; // Track how many chests opened this session
let lastChestOpenTime = null; // Track when last chest was opened
let chestDropCooldownUntil = 0; // Timestamp when we can drop again (after animation + buffer)
let isChestAnimationPlaying = false; // Track if animation is currently playing

// Timing constants
const CHEST_POST_ANIMATION_DELAY_MS = 10000; // 10 second buffer after animation ends

// ============ Audience-Based Like Tracking ============

function getAudienceLikes() {
    let total = 0;
    const viewers = document.querySelectorAll('app-audience .viewer-wrapper');

    viewers.forEach(viewer => {
        const likesEl = viewer.querySelector('.topfans-likes-icon')?.parentElement;
        if (likesEl) {
            // Extract just the number, removing commas and any extra text
            const text = likesEl.textContent.trim().replace(/,/g, '');
            const match = text.match(/[\d,]+/);
            if (match) {
                total += parseInt(match[0].replace(/,/g, '')) || 0;
            }
        }
    });

    return total;
}

function getAudienceBreakdown() {
    const fans = [];
    const viewers = document.querySelectorAll('app-audience .viewer-wrapper');

    viewers.forEach(viewer => {
        const nameEl = viewer.querySelector('.user-card__header .truncate');
        const likesEl = viewer.querySelector('.topfans-likes-icon')?.parentElement;

        if (nameEl && likesEl) {
            const name = nameEl.textContent.trim();
            const text = likesEl.textContent.trim().replace(/,/g, '');
            const match = text.match(/[\d,]+/);
            const likes = match ? parseInt(match[0].replace(/,/g, '')) : 0;
            if (likes > 0) {
                fans.push({ name, likes });
            }
        }
    });

    return fans;
}

// Fallback to toolbar if audience list isn't available
function getCurrentLikesFromToolbar() {
    const toolbarRight = document.querySelector('.toolbar__right');
    if (!toolbarRight) return null;

    const likeIcon = toolbarRight.querySelector('.ynicon-like');
    if (!likeIcon) return null;

    const valueDiv = likeIcon.parentElement?.querySelector('.toolbar__value');
    if (!valueDiv) return null;

    const text = valueDiv.textContent.trim().replace(/,/g, '');

    if (text.endsWith('K')) {
        return parseFloat(text) * 1000;
    } else if (text.endsWith('M')) {
        return parseFloat(text) * 1000000;
    }
    return parseInt(text) || 0;
}

// Get current likes - prefer audience list, fallback to toolbar
function getCurrentLikes() {
    const audienceLikes = getAudienceLikes();

    // If audience list has data, use it (more accurate)
    if (audienceLikes > 0) {
        return audienceLikes;
    }

    // Fallback to toolbar
    return getCurrentLikesFromToolbar() || 0;
}

function isBroadcasting() {
    // Check if the END button exists (only visible when broadcasting)
    const endButton = document.querySelector('.toolbar .button--red');
    return endButton !== null;
}

function createChestControls() {
    if (!isBroadcasting()) {
        chestLog('createChestControls: Not broadcasting, skipping');
        return;
    }
    if (document.getElementById('auto-chest-controls')) {
        return;
    }

    // Don't show on excluded pages
    if (EXCLUDED_FROM_AUTO_CHEST.some(name => window.location.pathname.toLowerCase() === '/' + name)) {
        chestLog('createChestControls: Excluded page, skipping');
        return;
    }

    // Don't show if user doesn't have a chest
    if (!document.querySelector('.chest-button')) {
        chestLog('createChestControls: No chest button found, skipping');
        return;
    }

    chestLog('createChestControls: Creating controls');

    // Ensure BetterNow toolbar exists (create it if needed)
    let betterNowToolbar = document.getElementById('betternow-toolbar');
    if (!betterNowToolbar) {
        chestLog('createChestControls: BetterNow toolbar not found, creating it');
        betterNowToolbar = createBetterNowToolbar();
        if (!betterNowToolbar) {
            chestLog('createChestControls: Could not create BetterNow toolbar');
            return;
        }
    }

    const leftSection = betterNowToolbar.querySelector('.betternow-toolbar__left');
    if (!leftSection) {
        chestLog('createChestControls: Left section not found');
        return;
    }

    // Add CSS to hide number input arrows
    if (!document.getElementById('chest-input-styles')) {
        const style = document.createElement('style');
        style.id = 'chest-input-styles';
        style.textContent = `
            #chest-threshold-input::-webkit-outer-spin-button,
            #chest-threshold-input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            #chest-threshold-input {
                -moz-appearance: textfield;
            }
        `;
        document.head.appendChild(style);
    }

    const btnStyle = window.BETTERNOW_BUTTON_STYLE || `
        border: none;
        color: var(--color-white, #fff);
        padding: 0.35em 0.7em;
        border-radius: 0.4em;
        font-size: 0.7em;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
        flex-shrink: 0;
    `;

    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'auto-chest-controls';
    controlsDiv.style.cssText = 'display: flex; align-items: center; gap: 8px; flex-shrink: 0;';
    controlsDiv.innerHTML = `
        <button id="auto-chest-toggle" title="Auto Chest Drop" style="
            ${btnStyle}
            background: var(--color-mediumgray, #888);
        ">AUTO CHEST</button>
        <div id="chest-threshold-controls" style="display: none; align-items: center; gap: 8px;">
            <input id="chest-threshold-input" type="text" value="${autoChestThreshold ? autoChestThreshold.toLocaleString() : ''}" placeholder="Likes" style="
                min-width: 70px;
                width: auto;
                background: var(--background-color, #212121);
                border: 1px solid var(--main-border-color, #4e4e4e);
                border-radius: 2rem;
                padding: .1rem .75rem;
                color: var(--color-text, white);
                font-size: .8rem;
                font-weight: 600;
                font-family: inherit;
                text-align: center;
                outline: none;
            " title="Drop chest every X likes (supports K and M suffixes)" />
            <button id="chest-threshold-update" style="
                display: none;
                background: var(--color-mediumgray, #888);
                border: none;
                border-radius: 2rem;
                padding: .1rem .75rem 0 .79rem;
                color: var(--color-white, #fff);
                font-size: .8rem;
                font-weight: 600;
                font-family: inherit;
                cursor: pointer;
                outline: none;
                transition: background 0.15s;
            ">Set</button>
            <span id="chest-update-status" style="
                color: var(--color-primary-green, #08d687);
                font-size: .75rem;
                font-weight: 600;
            "></span>
        </div>
    `;

    leftSection.appendChild(controlsDiv);

    // Move chest marker to end so chest is always last
    const chestMarker = document.getElementById('betternow-chest-marker');
    if (chestMarker) {
        leftSection.appendChild(chestMarker);
    }

    // Toggle button
    const toggleBtn = document.getElementById('auto-chest-toggle');
    const thresholdControls = document.getElementById('chest-threshold-controls');

    // Update button state based on current autoChestEnabled value
    if (autoChestEnabled) {
        toggleBtn.style.background = 'var(--color-primary-green, #08d687)';
        thresholdControls.style.display = 'flex';
    }

    toggleBtn.addEventListener('click', () => {
        autoChestEnabled = !autoChestEnabled;
        chestLog('Toggle clicked, autoChestEnabled:', autoChestEnabled);
        if (autoChestEnabled) {
            toggleBtn.style.background = 'var(--color-primary-green, #08d687)';
            thresholdControls.style.display = 'flex';
            startChestMonitoring();
        } else {
            toggleBtn.style.background = 'var(--color-mediumgray, #888)';
            thresholdControls.style.display = 'none';
            stopChestMonitoring();
            hideNoticeBar();
        }

        saveChestSettingsLocal();
    });

    // Threshold update button
    const thresholdInput = document.getElementById('chest-threshold-input');
    const updateBtn = document.getElementById('chest-threshold-update');
    const updateStatus = document.getElementById('chest-update-status');

    // Store the last saved value to detect changes
    let lastSavedValue = autoChestThreshold ? autoChestThreshold.toLocaleString() : '';

    // Clear input when focused
    thresholdInput.addEventListener('focus', () => {
        thresholdInput.value = '';
        thresholdInput.style.width = '70px';
        updateBtn.style.display = 'none';
    });

    // Format input with commas as user types, support K/M suffixes
    thresholdInput.addEventListener('input', () => {
        let raw = thresholdInput.value.trim();

        // Check for K or M suffix
        const upperRaw = raw.toUpperCase();
        let multiplier = 1;
        if (upperRaw.endsWith('K')) {
            multiplier = 1000;
            raw = raw.slice(0, -1);
        } else if (upperRaw.endsWith('M')) {
            multiplier = 1000000;
            raw = raw.slice(0, -1);
        }

        // Strip non-digits and parse
        const digits = raw.replace(/[^\d]/g, '');
        if (digits) {
            const num = parseInt(digits) * multiplier;
            thresholdInput.value = num.toLocaleString();
        }

        // Auto-resize input based on content
        const tempSpan = document.createElement('span');
        tempSpan.style.cssText = 'font-size: .8rem; font-weight: 600; font-family: inherit; visibility: hidden; position: absolute;';
        tempSpan.textContent = thresholdInput.value || thresholdInput.placeholder;
        document.body.appendChild(tempSpan);
        const newWidth = Math.max(70, tempSpan.offsetWidth + 30);
        thresholdInput.style.width = newWidth + 'px';
        tempSpan.remove();

        // Show/hide Set button based on whether value has changed
        if (thresholdInput.value !== lastSavedValue && thresholdInput.value !== '') {
            updateBtn.style.display = 'inline-block';
        } else {
            updateBtn.style.display = 'none';
        }
    });

    // Trigger resize on initial load if there's a value
    if (thresholdInput.value) {
        // Just resize, don't show button
        const tempSpan = document.createElement('span');
        tempSpan.style.cssText = 'font-size: .8rem; font-weight: 600; font-family: inherit; visibility: hidden; position: absolute;';
        tempSpan.textContent = thresholdInput.value;
        document.body.appendChild(tempSpan);
        const newWidth = Math.max(70, tempSpan.offsetWidth + 30);
        thresholdInput.style.width = newWidth + 'px';
        tempSpan.remove();
    }

    updateBtn.addEventListener('click', () => {
        // Strip commas before parsing
        const value = parseInt(thresholdInput.value.replace(/,/g, ''));
        if (!isNaN(value) && value > 0) {
            autoChestThreshold = value;
            chestLog('Threshold updated to:', autoChestThreshold);
            saveChestSettingsLocal();
            updateNoticeBar();

            // Reformat with commas
            thresholdInput.value = value.toLocaleString();

            // Update last saved value and hide Set button
            lastSavedValue = thresholdInput.value;
            updateBtn.style.display = 'none';

            // Flash green then back to grey
            updateBtn.style.background = 'var(--color-primary-green, #08d687)';
            setTimeout(() => {
                updateBtn.style.background = 'var(--color-mediumgray, #888)';
            }, 300);

            // Show status
            updateStatus.textContent = 'Set!';
            setTimeout(() => {
                updateStatus.textContent = '';
            }, 1500);
        } else {
            chestWarn('Invalid threshold value:', thresholdInput.value);
            // Show error
            updateStatus.style.color = '#ef4444';
            updateStatus.textContent = 'Invalid';
            setTimeout(() => {
                updateStatus.textContent = '';
                updateStatus.style.color = 'var(--color-primary-green, #08d687)';
            }, 1500);
        }
    });

    chestLog('Controls created successfully');
}

function removeChestControls() {
    const controls = document.getElementById('auto-chest-controls');
    if (controls) {
        chestLog('Removing chest controls');
        controls.remove();
    }
    removeNoticeBar();
}

function isChestDropping() {
    // Check if the chest lottie animation is visible (chest is currently dropping)
    const dropping = document.querySelector('app-chest-lottie') !== null;
    return dropping;
}

function getChestState() {
    const currentLikes = getCurrentLikes();
    const audienceLikes = getAudienceLikes();
    const toolbarLikes = getCurrentLikesFromToolbar();

    return {
        enabled: autoChestEnabled,
        threshold: autoChestThreshold,
        lastChestOpenLikes: lastChestOpenLikes,
        lastCheckedLikes: lastCheckedLikes,
        currentLikes: currentLikes,
        audienceLikes: audienceLikes,
        toolbarLikes: toolbarLikes,
        likesInChest: currentLikes - lastChestOpenLikes,
        isOpeningChest: isOpeningChest,
        isChestDropping: isChestDropping(),
        isBroadcasting: isBroadcasting(),
        sessionChestsOpened: chestOpenCount,
        lastChestOpenTime: lastChestOpenTime,
        audienceBreakdown: getAudienceBreakdown()
    };
}

async function checkChestThreshold() {
    if (!autoChestEnabled) {
        return;
    }

    if (!isBroadcasting()) {
        chestLog('checkChestThreshold: Not broadcasting');
        return;
    }

    if (isOpeningChest) {
        chestLog('checkChestThreshold: Already opening chest, skipping');
        return;
    }

    if (autoChestThreshold === null || autoChestThreshold <= 0) {
        chestLog('checkChestThreshold: No valid threshold set');
        return;
    }

    // Check cooldown first
    const now = Date.now();
    if (now < chestDropCooldownUntil) {
        return; // Silent skip during cooldown
    }

    // Check if animation is still playing
    if (isChestAnimationPlaying || isChestDropping()) {
        return; // Silent skip during animation
    }

    const currentLikes = getCurrentLikes();
    if (currentLikes === 0) {
        chestLog('checkChestThreshold: Could not get current likes (audience list may be empty)');
        return;
    }

    // Only log if likes changed
    if (currentLikes !== lastCheckedLikes) {
        const previousLikes = lastCheckedLikes;
        lastCheckedLikes = currentLikes;
        saveChestSettingsLocal();

        if (previousLikes !== null) {
            chestLog(`Likes changed: ${previousLikes.toLocaleString()} → ${currentLikes.toLocaleString()}`);
        }
    } else {
        return; // No change, skip further processing
    }

    // Detect new broadcast (likes reset or significantly lower than last opened)
    if (currentLikes < lastChestOpenLikes - 1000) { // Allow small fluctuations
        chestLog(`New broadcast detected: currentLikes (${currentLikes.toLocaleString()}) << lastChestOpenLikes (${lastChestOpenLikes.toLocaleString()}), resetting`);
        lastChestOpenLikes = 0;
        saveChestSettingsLocal();
    }

    // Calculate likes in chest
    const likesInChest = currentLikes - lastChestOpenLikes;

    chestLog(`Chest status: ${likesInChest.toLocaleString()} likes in chest, threshold: ${autoChestThreshold.toLocaleString()}`);

    // Check if threshold reached
    if (likesInChest >= autoChestThreshold) {
        chestLog(`*** THRESHOLD REACHED! Opening chest... ***`);
        await openChest(currentLikes);
    }
}

function saveChestSettingsLocal() {
    localStorage.setItem('betternow_autoChestEnabled', autoChestEnabled);
    localStorage.setItem('betternow_autoChestThreshold', autoChestThreshold);
    localStorage.setItem('betternow_lastChestOpenLikes', lastChestOpenLikes);
    localStorage.setItem('betternow_lastCheckedLikes', lastCheckedLikes);
    chestLog('Settings saved to localStorage');
}

function loadChestSettingsLocal() {
    const enabled = localStorage.getItem('betternow_autoChestEnabled');
    const threshold = localStorage.getItem('betternow_autoChestThreshold');
    const lastLikes = localStorage.getItem('betternow_lastChestOpenLikes');
    const lastChecked = localStorage.getItem('betternow_lastCheckedLikes');

    if (enabled !== null) autoChestEnabled = enabled === 'true';
    if (threshold !== null && threshold !== 'null') {
        const parsed = parseInt(threshold);
        autoChestThreshold = !isNaN(parsed) && parsed > 0 ? parsed : null;
    }
    if (lastLikes !== null) lastChestOpenLikes = parseInt(lastLikes);
    if (lastChecked !== null) lastCheckedLikes = parseInt(lastChecked);

    chestLog('Settings loaded from localStorage:', {
        enabled: autoChestEnabled,
        threshold: autoChestThreshold,
        lastChestOpenLikes: lastChestOpenLikes,
        lastCheckedLikes: lastCheckedLikes
    });
}

// Load chest settings on startup
loadChestSettingsLocal();

async function openChest(currentLikes) {
    isOpeningChest = true;
    const startTime = Date.now();
    chestLog('openChest: Starting chest open sequence');

    // Helper to find a button by text
    const findButtonByText = (text) => {
        const buttons = document.querySelectorAll('.button--green');
        for (const btn of buttons) {
            if (btn.textContent.trim() === text || btn.textContent.includes(text)) {
                return btn;
            }
        }
        return null;
    };

    // Check current state - is "Make it Rain" already visible?
    let makeItRainBtn = findButtonByText('Make it Rain');
    if (makeItRainBtn) {
        chestLog('openChest: Make it Rain already visible, skipping to that step');
    } else {
        // Check if "Open" button is visible
        let openButton = findButtonByText('Open');
        if (openButton) {
            chestLog('openChest: Open button already visible, skipping chest click');
        } else {
            // Need to click chest button first
            const chestButton = document.querySelector('.chest-button');
            if (!chestButton) {
                chestError('openChest: Chest button not found!');
                isOpeningChest = false;
                return;
            }

            chestLog('openChest: Clicking chest button');
            chestButton.click();

            // Wait for modal to appear
            await new Promise(resolve => setTimeout(resolve, 100));

            // Wait for Open button to appear (poll for up to 2 seconds)
            chestLog('openChest: Waiting for Open button...');
            for (let i = 0; i < 20; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                openButton = findButtonByText('Open');
                if (openButton) break;
            }

            if (!openButton) {
                chestError('openChest: Open button not found after 2s!');
                isOpeningChest = false;
                return;
            }
        }

        chestLog('openChest: Clicking Open button');
        openButton.click();

        // Wait for Make it Rain button to appear (poll for up to 2 seconds)
        chestLog('openChest: Waiting for Make it Rain button...');
        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            makeItRainBtn = findButtonByText('Make it Rain');
            if (makeItRainBtn) break;
        }

        if (!makeItRainBtn) {
            chestError('openChest: Make it Rain button not found after 2s!');
            isOpeningChest = false;
            return;
        }
    }

    chestLog('openChest: Clicking Make it Rain button');
    makeItRainBtn.click();

    // Update tracking
    const previousLastChestLikes = lastChestOpenLikes;
    const likesDropped = currentLikes - previousLastChestLikes;
    lastChestOpenLikes = currentLikes;
    chestOpenCount++;
    lastChestOpenTime = new Date().toISOString();

    // Mark animation as playing - cooldown will be set when animation ends
    isChestAnimationPlaying = true;

    saveChestSettingsLocal();

    chestLog(`openChest: Chest opened! Dropped ${likesDropped.toLocaleString()} likes. lastChestOpenLikes: ${previousLastChestLikes.toLocaleString()} → ${lastChestOpenLikes.toLocaleString()}, session total: ${chestOpenCount}`);

    // Update notice bar to show reset progress
    updateNoticeBar();

    // Wait a bit for the chest animation/modal transition
    await new Promise(resolve => setTimeout(resolve, 500));

    // Wait for "I'll Tell Them!" button to appear (poll for up to 2 seconds)
    chestLog('openChest: Waiting for Tell Them button...');
    let tellButton = null;
    for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        tellButton = findButtonByText('Tell Them');
        if (tellButton) break;
    }

    if (tellButton) {
        chestLog('openChest: Clicking Tell Them button');
        tellButton.click();
    } else {
        chestWarn('openChest: Tell Them button not found (non-critical)');
    }

    const duration = Date.now() - startTime;
    chestLog(`openChest: Sequence complete in ${duration}ms`);

    // Wait a bit before allowing another check
    await new Promise(resolve => setTimeout(resolve, 500));
    isOpeningChest = false;
}

function startChestMonitoring() {
    chestLog('startChestMonitoring: Starting audience observer');

    // Stop existing observers
    stopChestMonitoring();

    // Initialize last known likes
    lastKnownAudienceLikes = getAudienceLikes();
    chestLog('startChestMonitoring: Initial audience likes:', lastKnownAudienceLikes);

    // Watch the audience list for changes (this is where likes update in real-time)
    const audienceList = document.querySelector('app-audience');
    if (audienceList) {
        audienceObserver = new MutationObserver(() => {
            // Only process if likes actually changed (ignore joins/leaves/badge updates)
            const currentLikes = getAudienceLikes();
            if (currentLikes !== lastKnownAudienceLikes) {
                chestLog(`Audience likes changed: ${lastKnownAudienceLikes?.toLocaleString()} → ${currentLikes.toLocaleString()}`);
                lastKnownAudienceLikes = currentLikes;
                updateNoticeBar();
                updateChestModalIfOpen();
                checkChestThreshold();
            }
        });

        audienceObserver.observe(audienceList, {
            childList: true,
            subtree: true,
            characterData: true
        });

        chestLog('startChestMonitoring: Watching audience list for like changes only');
    } else {
        chestWarn('startChestMonitoring: Audience list not found, falling back to toolbar');
    }

    // Also watch toolbar as backup (in case audience list isn't visible)
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
        chestObserver = new MutationObserver(() => {
            // Only use toolbar if audience observer isn't working
            if (!audienceObserver) {
                checkChestThreshold();
            }
        });

        chestObserver.observe(toolbar, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // Watch for chest animation to detect manual chest drops
    setupChestAnimationObserver();

    // Run an initial check
    updateNoticeBar();
    checkChestThreshold();
}

// Observer to detect when chest animation appears/disappears
let chestAnimationObserver = null;

function setupChestAnimationObserver() {
    if (chestAnimationObserver) return;

    chestAnimationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // Check for animation ADDED (chest drop started)
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches?.('app-chest-lottie') || node.querySelector?.('app-chest-lottie')) {
                        chestLog('Chest animation started');
                        isChestAnimationPlaying = true;

                        // If we didn't trigger this (manual drop), reset the counter
                        if (!isOpeningChest) {
                            const currentLikes = getCurrentLikes();
                            chestLog('Manual chest drop detected, resetting counter at', currentLikes.toLocaleString(), 'likes');
                            lastChestOpenLikes = currentLikes;
                            chestOpenCount++;
                            lastChestOpenTime = new Date().toISOString();
                            saveChestSettingsLocal();
                        }

                        updateNoticeBar();
                        return;
                    }
                }
            }

            // Check for animation REMOVED (chest drop finished)
            for (const node of mutation.removedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches?.('app-chest-lottie') || node.querySelector?.('app-chest-lottie')) {
                        chestLog('Chest animation ended, starting 10s cooldown');
                        isChestAnimationPlaying = false;
                        chestDropCooldownUntil = Date.now() + CHEST_POST_ANIMATION_DELAY_MS;
                        updateNoticeBar();

                        // Schedule re-check after cooldown
                        setTimeout(() => {
                            if (autoChestEnabled && isBroadcasting()) {
                                chestLog('Post-cooldown re-check triggered');
                                lastCheckedLikes = null;
                                checkChestThreshold();
                            }
                        }, CHEST_POST_ANIMATION_DELAY_MS + 1000);

                        return;
                    }
                }
            }
        }
    });

    chestAnimationObserver.observe(document.body, { childList: true, subtree: true });
    chestLog('setupChestAnimationObserver: Watching for chest animation start/end');
}

function stopChestAnimationObserver() {
    if (chestAnimationObserver) {
        chestAnimationObserver.disconnect();
        chestAnimationObserver = null;
    }
}

function stopChestMonitoring() {
    if (audienceObserver) {
        chestLog('stopChestMonitoring: Stopping audience observer');
        audienceObserver.disconnect();
        audienceObserver = null;
    }
    if (chestObserver) {
        chestLog('stopChestMonitoring: Stopping toolbar observer');
        chestObserver.disconnect();
        chestObserver = null;
    }
    stopChestAnimationObserver();
    hideNoticeBar();
}

function checkBroadcastStatus() {
    const broadcasting = isBroadcasting();
    chestLog('checkBroadcastStatus: broadcasting =', broadcasting, ', autoChestEnabled =', autoChestEnabled);

    if (broadcasting) {
        createChestControls();
        if (autoChestEnabled) {
            startChestMonitoring();
        }
    } else {
        removeChestControls();
        stopChestMonitoring();
    }
}

// ============ Chest UI Override ============
// Override YouNow's chest modal to show BetterNow's calculated like count

function overrideChestModalLikes() {
    // Find the chest modal - can be either type
    const chestModal = document.querySelector('app-chest-modal, app-sidebar-modal-chest-broadcaster-education');
    if (!chestModal) {
        chestLog('overrideChestModalLikes: Modal not found');
        return;
    }

    const currentLikes = getCurrentLikes();
    const likesInChest = Math.max(0, currentLikes - lastChestOpenLikes);

    // Target the specific likes value element - try both selectors
    // education modal: .education-chest .total-likes .value
    // regular modal: .total-likes .value
    const likesValueEl = chestModal.querySelector('.education-chest .total-likes .value') ||
        chestModal.querySelector('.total-likes .value');

    if (likesValueEl) {
        const currentText = likesValueEl.textContent.trim();
        const newText = likesInChest.toLocaleString();

        if (currentText !== newText) {
            likesValueEl.textContent = newText;
            chestLog(`Chest modal UI: ${currentText} → ${newText}`);
        }
    } else {
        chestLog('overrideChestModalLikes: .total-likes .value not found');
    }
}

// Observer to detect chest modal opening
let chestModalObserver = null;
let chestModalOpen = false;

function setupChestModalObserver() {
    if (chestModalObserver) return;

    chestModalObserver = new MutationObserver((mutations) => {
        // Check if modal exists now (handles both adding and class/style changes)
        // The chest modal can be either app-chest-modal OR app-sidebar-modal-chest-broadcaster-education
        const modalExists = document.querySelector('app-chest-modal, app-sidebar-modal-chest-broadcaster-education') !== null;

        if (modalExists && !chestModalOpen) {
            chestLog('Chest modal opened');
            chestModalOpen = true;
            // Initial override after short delay for Angular to render
            setTimeout(() => {
                overrideChestModalLikes();
            }, 100);
        } else if (!modalExists && chestModalOpen) {
            chestLog('Chest modal closed');
            chestModalOpen = false;
        }
    });

    chestModalObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden']
    });

    chestLog('Chest modal observer initialized');
}

function updateChestModalIfOpen() {
    if (!chestModalOpen) return;

    const modal = document.querySelector('app-chest-modal');
    if (modal) {
        overrideChestModalLikes();
    } else {
        chestLog('Chest modal flag was true but modal not found, resetting flag');
        chestModalOpen = false;
    }
}

// Start observing for chest modal
setupChestModalObserver();

// Expose debug function globally
window.debugChest = function() {
    const state = getChestState();
    console.log('[BetterNow Chest] Current State:');
    console.log('  Enabled:', state.enabled);
    console.log('  Threshold:', state.threshold?.toLocaleString());
    console.log('  Current Likes (audience):', state.audienceLikes?.toLocaleString());
    console.log('  Current Likes (toolbar):', state.toolbarLikes?.toLocaleString());
    console.log('  Last Chest Opened At:', state.lastChestOpenLikes?.toLocaleString());
    console.log('  Likes In Chest:', state.likesInChest?.toLocaleString());
    console.log('  Is Opening:', state.isOpeningChest);
    console.log('  Is Dropping:', state.isChestDropping);
    console.log('  Session Drops:', state.sessionChestsOpened);
    console.log('');
    console.log('  Audience Breakdown:');
    state.audienceBreakdown.forEach((fan, i) => {
        console.log(`    #${i+1} ${fan.name}: ${fan.likes.toLocaleString()}`);
    });
    return state;
};

// Quick chest status
window.chestStatus = function() {
    const currentLikes = getCurrentLikes();
    const likesInChest = currentLikes - lastChestOpenLikes;
    const threshold = autoChestThreshold || 0;
    const untilDrop = Math.max(0, threshold - likesInChest);

    console.log('🎁 === Chest Status ===');
    console.log(`📊 Total likes: ${currentLikes.toLocaleString()}`);
    console.log(`📦 Last dropped at: ${lastChestOpenLikes.toLocaleString()}`);
    console.log(`✨ In chest now: ${likesInChest.toLocaleString()}`);
    console.log(`🎯 Threshold: ${threshold.toLocaleString()}`);
    console.log(`⏳ Until drop: ${untilDrop.toLocaleString()} more likes`);
};

// Sync chest tracking to current likes (useful after a break or manual drop)
window.syncChest = function() {
    const currentLikes = getCurrentLikes();
    lastChestOpenLikes = currentLikes;
    lastCheckedLikes = currentLikes;
    saveChestSettingsLocal();
    console.log(`✅ Chest synced! Tracking reset to ${currentLikes.toLocaleString()} likes`);
    console.log('💡 Chest now shows 0 likes accumulated');
};

chestLog('Chest module initialized (audience-based tracking)');