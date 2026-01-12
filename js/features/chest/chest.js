// ============ Chest Auto-Drop ============
// Automatically opens treasure chest when like threshold is reached

// Debug logging - set to false for production
const CHEST_DEBUG = false;

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
let isOpeningChest = false;
let lastCheckedLikes = null;
let chestOpenCount = 0; // Track how many chests opened this session
let lastChestOpenTime = null; // Track when last chest was opened
let chestDropCooldownUntil = 0; // Timestamp when we can check again after a chest drop

// Chest drop animation takes ~22-25 seconds, so we wait before checking again
const CHEST_DROP_COOLDOWN_MS = 22000;

function parseDisplayLikes(text) {
    // Parse "1,001" or "1.5K" or "2.3M" etc
    if (!text) return 0;
    text = text.trim().replace(/,/g, '');

    if (text.endsWith('K')) {
        return parseFloat(text) * 1000;
    } else if (text.endsWith('M')) {
        return parseFloat(text) * 1000000;
    } else if (text.endsWith('B')) {
        return parseFloat(text) * 1000000000;
    }
    return parseInt(text) || 0;
}

function getCurrentLikesFromToolbar() {
    // Find the likes in toolbar__right (not the partner tiers progress in the middle)
    const toolbarRight = document.querySelector('.toolbar__right');
    if (!toolbarRight) {
        chestLog('getCurrentLikesFromToolbar: toolbar__right not found');
        return null;
    }

    const likeIcon = toolbarRight.querySelector('.ynicon-like');
    if (!likeIcon) {
        chestLog('getCurrentLikesFromToolbar: like icon not found');
        return null;
    }

    const valueDiv = likeIcon.parentElement?.querySelector('.toolbar__value');
    if (!valueDiv) {
        chestLog('getCurrentLikesFromToolbar: toolbar__value not found');
        return null;
    }

    const likes = parseDisplayLikes(valueDiv.textContent);
    return likes;
}

function isBroadcasting() {
    // Check if the END button exists (only visible when broadcasting)
    const endButton = document.querySelector('.toolbar .button--red');
    const result = endButton !== null;
    return result;
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

    // Get the BetterNow toolbar's left section
    const betterNowToolbar = document.getElementById('betternow-toolbar');
    if (!betterNowToolbar) {
        chestLog('createChestControls: BetterNow toolbar not found');
        return;
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
}

function isChestDropping() {
    // Check if the chest lottie animation is visible (chest is currently dropping)
    const dropping = document.querySelector('app-chest-lottie') !== null;
    return dropping;
}

function getChestState() {
    return {
        enabled: autoChestEnabled,
        threshold: autoChestThreshold,
        lastChestOpenLikes: lastChestOpenLikes,
        lastCheckedLikes: lastCheckedLikes,
        currentLikes: getCurrentLikesFromToolbar(),
        isOpeningChest: isOpeningChest,
        isChestDropping: isChestDropping(),
        isBroadcasting: isBroadcasting(),
        chestCount: getCurrentLikesFromToolbar() - lastChestOpenLikes,
        sessionChestsOpened: chestOpenCount,
        lastChestOpenTime: lastChestOpenTime
    };
}

async function checkChestThreshold() {
    const state = getChestState();

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

    // Check cooldown first (avoids spammy logs during first 20s of chest drop animation)
    const now = Date.now();
    if (now < chestDropCooldownUntil) {
        return; // Silent skip during cooldown
    }

    // After cooldown, check if animation is still playing
    if (isChestDropping()) {
        chestLog('checkChestThreshold: Chest still dropping after cooldown, waiting...');
        return;
    }

    const currentLikes = getCurrentLikesFromToolbar();
    if (currentLikes === null) {
        chestWarn('checkChestThreshold: Could not get current likes');
        return;
    }

    // Only check if likes changed
    if (currentLikes === lastCheckedLikes) {
        return;
    }

    const previousLikes = lastCheckedLikes;
    lastCheckedLikes = currentLikes;
    saveChestSettingsLocal();

    chestLog(`Likes changed: ${previousLikes} → ${currentLikes}`);

    // Detect new broadcast (likes reset or lower than last opened)
    if (currentLikes < lastChestOpenLikes) {
        chestLog(`New broadcast detected: currentLikes (${currentLikes}) < lastChestOpenLikes (${lastChestOpenLikes}), resetting`);
        lastChestOpenLikes = 0;
        saveChestSettingsLocal();
    }

    // Calculate chest count
    const likesSinceLastChest = currentLikes - lastChestOpenLikes;

    chestLog(`Threshold check: ${likesSinceLastChest} likes since last chest, threshold: ${autoChestThreshold}`);

    // Check if threshold reached
    if (likesSinceLastChest >= autoChestThreshold) {
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

    // Click the chest button
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
    let openButton = null;
    for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const buttons = document.querySelectorAll('.button--green');
        for (const btn of buttons) {
            if (btn.textContent.trim() === 'Open') {
                openButton = btn;
                break;
            }
        }
        if (openButton) break;
    }

    if (!openButton) {
        chestError('openChest: Open button not found after 2s!');
        isOpeningChest = false;
        return;
    }

    chestLog('openChest: Clicking Open button');
    openButton.click();

    // Wait for Make it Rain button to appear (poll for up to 2 seconds)
    chestLog('openChest: Waiting for Make it Rain button...');
    let rainButton = null;
    for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const buttons = document.querySelectorAll('.button--green');
        for (const btn of buttons) {
            if (btn.textContent.includes('Make it Rain')) {
                rainButton = btn;
                break;
            }
        }
        if (rainButton) break;
    }

    if (!rainButton) {
        chestError('openChest: Make it Rain button not found after 2s!');
        isOpeningChest = false;
        return;
    }

    chestLog('openChest: Clicking Make it Rain button');
    rainButton.click();

    // Update tracking
    const previousLastChestLikes = lastChestOpenLikes;
    lastChestOpenLikes = currentLikes;
    chestOpenCount++;
    lastChestOpenTime = new Date().toISOString();
    chestDropCooldownUntil = Date.now() + CHEST_DROP_COOLDOWN_MS; // Wait 20s for drop animation
    saveChestSettingsLocal();

    chestLog(`openChest: Chest opened! lastChestOpenLikes: ${previousLastChestLikes} → ${lastChestOpenLikes}, session total: ${chestOpenCount}`);

    // Wait a bit for the chest animation/modal transition
    await new Promise(resolve => setTimeout(resolve, 500));

    // Wait for "I'll Tell Them!" button to appear (poll for up to 2 seconds)
    chestLog('openChest: Waiting for Tell Them button...');
    let tellButton = null;
    for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const buttons = document.querySelectorAll('.button--green');
        for (const btn of buttons) {
            if (btn.textContent.includes('Tell Them')) {
                tellButton = btn;
                break;
            }
        }
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
    if (chestObserver) {
        chestLog('startChestMonitoring: Already monitoring');
        return;
    }

    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) {
        chestWarn('startChestMonitoring: Toolbar not found');
        return;
    }

    chestLog('startChestMonitoring: Starting observer');

    chestObserver = new MutationObserver(() => {
        checkChestThreshold();
    });

    chestObserver.observe(toolbar, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // Also run an initial check
    checkChestThreshold();
}

function stopChestMonitoring() {
    if (chestObserver) {
        chestLog('stopChestMonitoring: Stopping observer');
        chestObserver.disconnect();
        chestObserver = null;
    }
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

// Expose debug function globally
window.debugChest = function() {
    const state = getChestState();
    console.log('[BetterNow Chest] Current State:');
    console.table(state);
    return state;
};

chestLog('Chest module initialized');