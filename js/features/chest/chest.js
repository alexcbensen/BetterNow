// ============ Chest Auto-Drop ============
// Automatically opens treasure chest when like threshold is reached
// Uses audience list for accurate like tracking (not rounded toolbar values)

// Debug logging - set to true for debugging sync issues
const CHEST_DEBUG = false;

// Timing constants for chest drop sequence
const CHEST_DROP_TOTAL_DELAY_MS = 20000; // Total time from threshold to drop (20s countdown)
const CHEST_DROP_COUNTDOWN_MS = 20000;   // Countdown shown to users (full 20s)
const CHEST_UI_INTERACTION_MS = 6000;    // Time for broadcaster to click through UI (chest → Open → Make it Rain) with 2s delays

// Get formatted timestamp for logging
function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
}

// Track last status bar state to avoid duplicate logs
let lastStatusBarState = '';

// Log status bar changes with timestamp
function logStatusBarUpdate(role, likes, threshold, status, extra = '') {
    const state = `${likes}/${threshold} ${status}`;

    // Only log if state changed
    if (state === lastStatusBarState) return;
    lastStatusBarState = state;

    const timestamp = getTimestamp();
    const extraInfo = extra ? ` (${extra})` : '';
    chestLog(`STATUS BAR [${role}] ${timestamp}: ${likes.toLocaleString()}/${threshold.toLocaleString()} likes | ${status}${extraInfo}`);
}

// ============ Notice Bar ============
// Displays chest progress to all BetterNow users watching the stream

function createNoticeBar() {
    if (document.getElementById('betternow-notice-bar')) {
        return document.getElementById('betternow-notice-bar');
    }

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

    // Insert after BetterNow toolbar if it exists, otherwise before YouNow toolbar
    const betternowToolbar = document.getElementById('betternow-toolbar');
    const youNowToolbar = document.querySelector('app-top-toolbar');

    if (betternowToolbar && betternowToolbar.nextSibling) {
        betternowToolbar.parentNode.insertBefore(noticeBar, betternowToolbar.nextSibling);
    } else if (youNowToolbar) {
        youNowToolbar.parentNode.insertBefore(noticeBar, youNowToolbar);
    } else {
        chestLog('createNoticeBar: Could not find toolbar to insert notice bar');
        return null;
    }

    return noticeBar;
}


function updateNoticeBar() {
    // Only for broadcasters
    if (!isBroadcasting()) return;

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

    // Check if we're in countdown mode (waiting to drop chest)
    if (isChestCountingDown && chestDropStartTime > 0) {
        const elapsed = Date.now() - chestDropStartTime;
        const remaining = Math.max(0, CHEST_DROP_TOTAL_DELAY_MS - elapsed);
        const secondsRemaining = Math.ceil(remaining / 1000);

        // During countdown, show CURRENT likesInChest (keeps updating as more likes come in)
        // All these likes WILL be dropped - not up to us, YouNow drops everything in chest
        const droppingAmount = likesInChest;

        // Also update likesBeingDropped for Firebase (so viewers see updated amount)
        if (likesBeingDropped !== droppingAmount) {
            likesBeingDropped = droppingAmount;
            saveChestSettingsLocal(); // Update Firebase with new amount
        }

        logStatusBarUpdate('BROADCASTER', droppingAmount, threshold, `Dropping in ${secondsRemaining}s`, 'countdown');
        noticeBar.innerHTML = `
            <span>Chest auto-drop enabled:</span>
            <span style="font-weight: 600;">
                ${droppingAmount.toLocaleString()} / ${threshold.toLocaleString()} likes
            </span>
            <span style="color: var(--color-mediumgray, #888);">|</span>
            <span style="color: var(--color-white, #fff);">
                Dropping in ${secondsRemaining}s
            </span>
        `;
        noticeBar.style.display = 'flex';
        return;
    }

    // Normal display - show likes progress
    let statusHtml = '';
    let statusText = 'progress';
    let displayLikes = likesInChest;
    const hasEnoughForNextDrop = likesInChest >= threshold;

    // During animation, show NEW likes accumulating for next drop
    // Since lastChestOpenLikes was updated when API call succeeded, likesInChest shows queued likes
    if (isChestAnimationPlaying) {
        displayLikes = likesInChest; // New likes since drop started (starts at 0)
        // Show "Queued" only if we already have enough for another drop
        statusText = hasEnoughForNextDrop ? 'Queued' : 'Dropping...';
        statusHtml = `
            <span style="color: var(--color-mediumgray, #888);">|</span>
            <span style="color: var(--color-white, #fff);">
                ${statusText}
            </span>
        `;
    } else if (awaitingDropConfirmation && hasEnoughForNextDrop) {
        // Awaiting confirmation - show message and confirm button
        statusText = 'Ready';
        statusHtml = `
            <span style="color: var(--color-mediumgray, #888);">|</span>
            <span>Threshold already met</span>
            <button id="chest-confirm-drop-btn" style="
                background: var(--color-primary-green, #08d687);
                border: none;
                color: #000;
                padding: 0.35em 0.7em;
                border-radius: 0.4em;
                font-size: 0.7em;
                font-weight: 600;
                letter-spacing: 0.1em;
                text-transform: uppercase;
                cursor: pointer;
                font-family: inherit;
                white-space: nowrap;
                margin-left: 8px;
            ">Start Countdown</button>
        `;
    } else if (hasEnoughForNextDrop) {
        // Not in animation, but threshold met - show Queued
        statusText = 'Queued';
        statusHtml = `
            <span style="color: var(--color-mediumgray, #888);">|</span>
            <span style="color: var(--color-white, #fff);">
                Queued
            </span>
        `;
    }

    logStatusBarUpdate('BROADCASTER', displayLikes, threshold, statusText);
    noticeBar.innerHTML = `
        <span>Chest auto-drop enabled:</span>
        <span style="font-weight: 600;">
            ${displayLikes.toLocaleString()} / ${threshold.toLocaleString()} likes
        </span>
        ${statusHtml}
    `;

    // Attach event handler for confirmation button if present
    const confirmBtn = noticeBar.querySelector('#chest-confirm-drop-btn');

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            chestLog('User confirmed drop via notice bar');
            awaitingDropConfirmation = false;
            saveChestSettingsLocal(); // Save state to Firebase

            // Directly start the drop - don't use checkChestThreshold which requires likes change
            const currentLikes = getCurrentLikes();
            await openChest(currentLikes);
        });
    }

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
        console.log(`[BetterNow Chest ${getTimestamp()}]`, ...args);
    }
}

function chestWarn(...args) {
    console.warn(`[BetterNow Chest ${getTimestamp()}]`, ...args);
}

function chestError(...args) {
    console.error(`[BetterNow Chest ${getTimestamp()}]`, ...args);
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
let animationStartedResolver = null; // Promise resolver for API verification
let likesBeingDropped = 0; // Amount of likes in current drop (saved to Firebase for viewers)
let awaitingDropConfirmation = false; // Waiting for broadcaster to confirm/skip initial drop

// Timing constants
const CHEST_POST_ANIMATION_DELAY_MS = 10000; // 10 second buffer after animation ends

// ============ Delay Measurement ============
// Set delayMeasurementEnabled to true to log timestamps for API vs Audience likes
// Use these logs to calculate the delay between API and Audience list updates
let delayMeasurementEnabled = false; // Disabled for production
let lastLoggedApiLikes = null;
let lastLoggedAudienceLikes = null;

function logDelayMeasurement(source, likes) {
    if (!delayMeasurementEnabled) return;
    const timestamp = new Date().toISOString();
    const timeMs = Date.now();
    console.log(`[BetterNow Delay] ${timestamp} | ${timeMs} | ${source}: ${likes} likes`);
}

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

    // Log for delay measurement (only when value changes)
    if (delayMeasurementEnabled && total !== lastLoggedAudienceLikes) {
        logDelayMeasurement('AUDIENCE', total);
        lastLoggedAudienceLikes = total;
    }

    return total;
}

// Fetch likes from broadcast API (more accurate than audience list which has delay)
// Used during critical windows: last 3s of countdown, first 3s of animation
let lastApiFetchTime = 0;
let lastApiFetchLikes = null;
const API_FETCH_COOLDOWN_MS = 500; // Don't fetch more than every 500ms

async function fetchBroadcastLikesFromAPI() {
    const now = Date.now();

    // Rate limit API calls
    if (now - lastApiFetchTime < API_FETCH_COOLDOWN_MS && lastApiFetchLikes !== null) {
        return lastApiFetchLikes;
    }

    try {
        const broadcasterId = await getBroadcasterUserId();
        if (!broadcasterId) return null;

        const response = await fetch(`https://api.younow.com/php/api/broadcast/info/channelId=${broadcasterId}`);
        if (!response.ok) {
            chestWarn('fetchBroadcastLikesFromAPI: HTTP error', response.status);
            return null;
        }

        const data = await response.json();

        // The broadcast info should include total likes
        if (data.likes !== undefined) {
            lastApiFetchTime = now;
            lastApiFetchLikes = parseInt(data.likes) || 0;

            // Log for delay measurement (only when value changes)
            if (lastApiFetchLikes !== lastLoggedApiLikes) {
                logDelayMeasurement('API', lastApiFetchLikes);
                lastLoggedApiLikes = lastApiFetchLikes;
            }

            chestLog(`fetchBroadcastLikesFromAPI: Got ${lastApiFetchLikes} likes from API`);
            return lastApiFetchLikes;
        }

        return null;
    } catch (e) {
        chestError('fetchBroadcastLikesFromAPI: Error:', e);
        return null;
    }
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

// Simulate a proper click that works with Angular's event system
// YouNow uses Angular which may not respond to simple .click() calls
function simulateClick(element) {
    if (!element) return false;

    // Focus the element first
    if (element.focus) {
        element.focus();
    }

    // Get element's bounding box for realistic coordinates
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const eventOptions = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: 1
    };

    // Try PointerEvents first (modern standard, what Angular often uses)
    try {
        element.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
        element.dispatchEvent(new PointerEvent('pointerup', eventOptions));
    } catch (e) {
        // Fallback if PointerEvent not supported
    }

    // Also dispatch MouseEvents
    element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
    element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
    element.dispatchEvent(new MouseEvent('click', eventOptions));

    // Also try the simple click as backup
    element.click();

    return true;
}

// ============ Sync with YouNow API ============
// Fetches the actual chest likes from YouNow's API to sync our tracking
// This handles cases where likes were already in the chest before auto-chest was enabled

let chestSyncedThisSession = false;

// Call YouNow's chest open API directly instead of simulating clicks
async function callChestOpenAPI() {
    if (!currentUserId) {
        chestError('callChestOpenAPI: No currentUserId');
        return false;
    }

    // Get TDI from localStorage - YouNow stores it as TRPX_DEVICE_ID
    const tdi = localStorage.getItem('TRPX_DEVICE_ID');
    if (!tdi) {
        chestWarn('callChestOpenAPI: No TRPX_DEVICE_ID in localStorage');
        return false;
    }

    // Get X-Requested-By from localStorage (YouNow stores it as REQUEST_BY)
    const xRequestedBy = localStorage.getItem('REQUEST_BY');
    if (!xRequestedBy) {
        chestWarn('callChestOpenAPI: No REQUEST_BY in localStorage');
        return false;
    }

    chestLog('callChestOpenAPI: Got TDI:', tdi.substring(0, 4) + '...', 'X-Requested-By:', xRequestedBy.substring(0, 8) + '...');

    // Use XMLHttpRequest to match YouNow's exact approach (not fetch)
    // YouNow's Angular app uses XHR which goes through Zone.js
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.younow.com/php/api/props/propsChestOpen', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
        xhr.setRequestHeader('X-Requested-By', xRequestedBy);
        xhr.withCredentials = true;

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                try {
                    const openData = JSON.parse(xhr.responseText);
                    chestLog('callChestOpenAPI: Response:', openData);

                    if (openData.errorCode && openData.errorCode !== 0) {
                        chestWarn('callChestOpenAPI: API error:', openData.errorMsg || openData.errorCode);
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                } catch (e) {
                    chestError('callChestOpenAPI: Parse error:', e);
                    resolve(false);
                }
            }
        };

        xhr.onerror = function() {
            chestError('callChestOpenAPI: XHR error');
            resolve(false);
        };

        const body = `userId=${currentUserId}&tdi=${encodeURIComponent(tdi)}&lang=en`;
        chestLog('callChestOpenAPI: Sending XHR with body:', body.substring(0, 30) + '...');
        xhr.send(body);
    });
}

async function syncChestWithYouNow() {
    // Get username from URL
    const username = window.location.pathname.split('/')[1];
    if (!username) {
        chestWarn('syncChestWithYouNow: Could not get username from URL');
        return false;
    }

    try {
        const response = await fetch(`https://api.younow.com/php/api/broadcast/info/curId=0/lang=en/user=${username}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            chestWarn('syncChestWithYouNow: API returned', response.status);
            return false;
        }

        const data = await response.json();

        if (!data.propsChest || typeof data.propsChest.likes !== 'number') {
            chestLog('syncChestWithYouNow: No propsChest data in response');
            return false;
        }

        const chestLikes = data.propsChest.likes;
        const currentStreamLikes = getCurrentLikes();

        // Calculate what lastChestOpenLikes should be
        // Formula: lastChestOpenLikes = currentStreamLikes - chestLikes
        // This can be negative if chest has carried-over likes from previous streams
        const newLastChestOpenLikes = currentStreamLikes - chestLikes;

        chestLog(`syncChestWithYouNow: YouNow chest has ${chestLikes.toLocaleString()} likes`);
        chestLog(`syncChestWithYouNow: Current stream likes: ${currentStreamLikes.toLocaleString()}`);
        chestLog(`syncChestWithYouNow: Setting lastChestOpenLikes: ${lastChestOpenLikes.toLocaleString()} → ${newLastChestOpenLikes.toLocaleString()}`);

        lastChestOpenLikes = newLastChestOpenLikes;
        chestSyncedThisSession = true;
        saveChestSettingsLocal();

        return true;
    } catch (e) {
        chestError('syncChestWithYouNow: Error fetching chest data:', e);
        return false;
    }
}

// Sync chest when auto-chest is enabled (if not already synced this session)
async function syncChestIfNeeded() {
    if (chestSyncedThisSession) {
        return;
    }

    // Only sync for broadcasters
    if (!isBroadcasting()) {
        chestLog('syncChestIfNeeded: Not broadcasting, skipping sync');
        return;
    }

    chestLog('syncChestIfNeeded: Syncing chest with YouNow API...');
    const success = await syncChestWithYouNow();
    if (success) {
        chestLog('syncChestIfNeeded: Sync successful');
        updateNoticeBar();
    } else {
        chestWarn('syncChestIfNeeded: Sync failed, using existing tracking');
    }
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

    // Check global kill switch (admins and users with explicit grant bypass)
    const isAdmin = typeof ADMIN_USER_IDS !== 'undefined' && ADMIN_USER_IDS.includes(currentUserId);
    const hasExplicitGrant = typeof grantedFeatures !== 'undefined' && grantedFeatures[currentUserId]?.includes('autoChest');
    if (!isAdmin && !hasExplicitGrant && typeof globalAutoChestEnabled !== 'undefined' && !globalAutoChestEnabled) {
        chestLog('createChestControls: Auto Chest globally disabled by admin');
        return;
    }

    // Check if user has access to autoChest feature
    if (typeof userHasFeature === 'function' && !userHasFeature('autoChest')) {
        chestLog('createChestControls: User does not have autoChest feature, skipping');
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
        toggleBtn.style.color = '#000';
        thresholdControls.style.display = 'flex';
    }

    let toggleCooldown = false;
    const TOGGLE_COOLDOWN_MS = 1000; // 1 second cooldown between toggles

    toggleBtn.addEventListener('click', async () => {
        // Prevent rapid toggling
        if (toggleCooldown) {
            return;
        }
        toggleCooldown = true;
        setTimeout(() => { toggleCooldown = false; }, TOGGLE_COOLDOWN_MS);

        autoChestEnabled = !autoChestEnabled;
        chestLog('Toggle clicked, autoChestEnabled:', autoChestEnabled);
        if (autoChestEnabled) {
            toggleBtn.style.background = 'var(--color-primary-green, #08d687)';
            toggleBtn.style.color = '#000';
            thresholdControls.style.display = 'flex';

            // Sync with YouNow API before starting monitoring
            await syncChestIfNeeded();

            // Check if threshold is already exceeded
            if (autoChestThreshold && autoChestThreshold > 0) {
                const currentLikes = getCurrentLikes();
                const likesInChest = currentLikes - lastChestOpenLikes;

                if (likesInChest >= autoChestThreshold) {
                    // Threshold already met - set awaiting confirmation state
                    chestLog('Threshold already met, awaiting confirmation');
                    awaitingDropConfirmation = true;
                }
            }

            startChestMonitoring();
        } else {
            toggleBtn.style.background = 'var(--color-mediumgray, #888)';
            toggleBtn.style.color = 'var(--color-white, #fff)';
            thresholdControls.style.display = 'none';
            awaitingDropConfirmation = false;
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
        // Only remove notice bar if we're the broadcaster
        // Viewers don't have chest controls but may have notice bar
        removeNoticeBar();
    }
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
        // Don't auto-drop if awaiting confirmation
        if (awaitingDropConfirmation) {
            chestLog('Threshold reached but awaiting confirmation, skipping auto-drop');
            updateNoticeBar();
            return;
        }
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

    // Also sync to Firebase for viewers (throttled to reduce writes)
    maybeUpdateFirebase();
}

// Track last Firebase write to avoid duplicate writes
let lastFirebaseEnabled = null;
let lastFirebaseThreshold = null;
let lastFirebaseChestOpenLikes = null;
let lastFirebaseChestDropStartTime = null;

function maybeUpdateFirebase() {
    if (!isBroadcasting()) return;

    const settingsChanged = autoChestEnabled !== lastFirebaseEnabled ||
        autoChestThreshold !== lastFirebaseThreshold ||
        lastChestOpenLikes !== lastFirebaseChestOpenLikes ||
        chestDropStartTime !== lastFirebaseChestDropStartTime;

    // Only save if settings changed
    if (settingsChanged) {
        chestLog('maybeUpdateFirebase: Saving - enabled:', autoChestEnabled, 'threshold:', autoChestThreshold, 'lastChestOpenLikes:', lastChestOpenLikes, 'chestDropStartTime:', chestDropStartTime);
        lastFirebaseEnabled = autoChestEnabled;
        lastFirebaseThreshold = autoChestThreshold;
        lastFirebaseChestOpenLikes = lastChestOpenLikes;
        lastFirebaseChestDropStartTime = chestDropStartTime;
        saveChestSettingsToFirebase();
    }
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

// ============ Firebase Chest Settings Sync ============
// Broadcasters save their settings to Firebase
// Viewers load broadcaster's settings from Firebase

let broadcasterChestSettings = null; // Cached settings for current broadcaster (viewer mode)

// Get broadcaster userId from page URL
async function getBroadcasterUserId() {
    const path = window.location.pathname;
    const match = path.match(/^\/([^\/]+)/);
    if (!match) return null;

    const username = match[1].toLowerCase();
    if (!username || username === 'explore' || username === 'moments') return null;

    try {
        const response = await fetch(`https://cdn.younow.com/php/api/channel/getInfo/user=${username}`);
        const data = await response.json();
        return data.userId ? String(data.userId) : null;
    } catch (e) {
        chestError('getBroadcasterUserId: Error fetching user info:', e);
        return null;
    }
}

// Track chest drop animation start time (for viewer countdown)
let chestDropStartTime = 0;
const CHEST_DROP_DURATION_MS = 30000; // Animation is ~30 seconds

// Save broadcaster's chest settings to Firebase
// Saves: enabled, threshold, lastChestOpenLikes, chestDropStartTime, likesBeingDropped
// Track last saved enabled state to only update chestEnabled when it changes
let lastSavedChestEnabled = null;
let lastSavedChestThreshold = null;
let lastSavedAwaitingConfirmation = null;
let lastSavedChestDropStartTime = null;
let lastSavedLikesBeingDropped = null;

async function saveChestSettingsToFirebase() {
    if (!isBroadcasting()) return; // Only broadcasters save

    if (!currentUserId) {
        chestWarn('saveChestSettingsToFirebase: currentUserId not set, cannot save');
        return;
    }

    // Check if Firebase is available
    if (typeof FIRESTORE_BASE_URL === 'undefined') {
        chestWarn('saveChestSettingsToFirebase: Firebase not available');
        return;
    }

    const settings = {
        enabled: autoChestEnabled,
        threshold: autoChestThreshold || 0,
        lastChestOpenLikes: lastChestOpenLikes || 0,
        chestDropStartTime: chestDropStartTime || 0,
        likesBeingDropped: likesBeingDropped || 0,
        awaitingConfirmation: awaitingDropConfirmation || false
    };

    chestLog('saveChestSettingsToFirebase: Saving for user', currentUserId, settings);

    try {
        // FIRST: Save to chestEnabled (viewers subscribe to this via realtime listener)
        // This must happen BEFORE chestSettings so viewers get the update immediately
        if (lastSavedChestEnabled !== autoChestEnabled ||
            lastSavedChestThreshold !== autoChestThreshold ||
            lastSavedAwaitingConfirmation !== awaitingDropConfirmation ||
            lastSavedChestDropStartTime !== chestDropStartTime ||
            lastSavedLikesBeingDropped !== likesBeingDropped) {
            chestLog('saveChestSettingsToFirebase: State changed, updating chestEnabled collection FIRST');
            if (typeof saveChestEnabledToFirebase === 'function') {
                await saveChestEnabledToFirebase(autoChestEnabled, autoChestThreshold || 0, awaitingDropConfirmation || false, chestDropStartTime || 0, likesBeingDropped || 0);
            }
            lastSavedChestEnabled = autoChestEnabled;
            lastSavedChestThreshold = autoChestThreshold;
            lastSavedAwaitingConfirmation = awaitingDropConfirmation;
            lastSavedChestDropStartTime = chestDropStartTime;
            lastSavedLikesBeingDropped = likesBeingDropped;
        }

        // THEN: Save to chestSettings (frequently updated - likes, timestamps)
        const response = await fetch(
            `${FIRESTORE_BASE_URL}/chestSettings/${currentUserId}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: {
                        enabled: { booleanValue: settings.enabled },
                        threshold: { integerValue: settings.threshold },
                        lastChestOpenLikes: { integerValue: settings.lastChestOpenLikes },
                        chestDropStartTime: { integerValue: settings.chestDropStartTime },
                        likesBeingDropped: { integerValue: settings.likesBeingDropped },
                        awaitingConfirmation: { booleanValue: settings.awaitingConfirmation }
                    }
                })
            }
        );

        if (!response.ok) {
            chestWarn('saveChestSettingsToFirebase: HTTP error', response.status);
        } else {
            chestLog('saveChestSettingsToFirebase: Saved successfully');
        }
    } catch (e) {
        chestError('saveChestSettingsToFirebase: Error:', e);
    }
}

// Session cache for broadcasters with no chest settings (avoids repeated 404s)
// Cleared on page refresh, so we'll re-check each session
const broadcastersWithNoSettings = new Set();

// Load broadcaster's chest settings from Firebase (called by viewers once on page load)
async function loadBroadcasterChestSettings() {
    if (isBroadcasting()) return null; // Broadcasters use their own settings

    // Return cached settings if available
    if (broadcasterChestSettings) {
        return broadcasterChestSettings;
    }

    const broadcasterId = await getBroadcasterUserId();
    if (!broadcasterId) {
        chestLog('loadBroadcasterChestSettings: Could not get broadcaster ID');
        return null;
    }

    // Skip fetch if we already know this broadcaster has no settings (this session)
    if (broadcastersWithNoSettings.has(broadcasterId)) {
        chestLog('loadBroadcasterChestSettings: Skipping fetch, broadcaster has no settings (cached)');
        return null;
    }

    // Check if Firebase is available
    if (typeof FIRESTORE_BASE_URL === 'undefined') {
        chestWarn('loadBroadcasterChestSettings: Firebase not available');
        return null;
    }

    chestLog('loadBroadcasterChestSettings: Fetching settings for broadcaster', broadcasterId);

    try {
        const response = await fetch(`${FIRESTORE_BASE_URL}/chestSettings/${broadcasterId}`);

        if (response.status === 404) {
            // No settings saved for this broadcaster - cache this for the session
            broadcastersWithNoSettings.add(broadcasterId);
            chestLog('loadBroadcasterChestSettings: No settings for this broadcaster (cached for session)');
            broadcasterChestSettings = null;
            return null;
        }

        if (!response.ok) {
            chestWarn('loadBroadcasterChestSettings: HTTP error', response.status);
            return null;
        }

        const data = await response.json();

        if (data.fields) {
            broadcasterChestSettings = {
                enabled: data.fields.enabled?.booleanValue || false,
                threshold: parseInt(data.fields.threshold?.integerValue) || 0,
                lastChestOpenLikes: parseInt(data.fields.lastChestOpenLikes?.integerValue) || 0,
                chestDropStartTime: parseInt(data.fields.chestDropStartTime?.integerValue) || 0,
                likesBeingDropped: parseInt(data.fields.likesBeingDropped?.integerValue) || 0,
                awaitingConfirmation: data.fields.awaitingConfirmation?.booleanValue || false
            };

            chestLog('loadBroadcasterChestSettings: Loaded', broadcasterChestSettings);
            return broadcasterChestSettings;
        }
    } catch (e) {
        chestError('loadBroadcasterChestSettings: Error:', e);
    }

    return null;
}

// Update notice bar for viewers (shows broadcaster's chest status)
// Uses local audience list for current likes, Firebase only for settings
function updateViewerNoticeBar() {
    if (isBroadcasting()) return; // Broadcasters use updateNoticeBar()

    let noticeBar = document.getElementById('betternow-notice-bar');

    // Need settings from Firebase (loaded once on page load)
    if (!broadcasterChestSettings) {
        if (noticeBar) noticeBar.style.display = 'none';
        return;
    }

    const settings = broadcasterChestSettings;

    // Hide if broadcaster doesn't have auto-chest enabled
    if (!settings.enabled || !settings.threshold || settings.threshold <= 0) {
        if (noticeBar) noticeBar.style.display = 'none';
        return;
    }

    // Create bar if it doesn't exist
    if (!noticeBar) {
        noticeBar = createNoticeBar();
        if (!noticeBar) return;
    }

    // Check if chest is currently dropping (countdown mode)
    if (viewerCountdownActive) {
        // Countdown is handled by the countdown interval
        return;
    }

    // Check if waiting for animation to start after countdown
    if (viewerWaitingForAnimation) {
        // Don't update - waiting for animation to appear
        return;
    }

    const threshold = settings.threshold;

    // Check if chest animation is currently playing
    const isAnimationPlaying = document.querySelector('app-chest-lottie') !== null;

    // During animation (or waiting for it to start), show NEW likes accumulating for next drop
    // Use viewerDropBaseline which was set when countdown ended
    if (isAnimationPlaying || viewerWaitingForAnimation) {
        const now = Date.now();

        // During first 3 seconds of animation, use API for accurate baseline
        // (audience list may still show likes that were counted in the drop)
        if (viewerApiPollingEndTime > 0 && now < viewerApiPollingEndTime) {
            // Fetch from API asynchronously
            fetchBroadcastLikesFromAPI().then(apiLikes => {
                if (apiLikes !== null && viewerDropBaseline > 0) {
                    // If API shows FEWER likes than our baseline, that's correct
                    // (some likes we thought were "new" were actually in the drop)
                    if (apiLikes < viewerDropBaseline) {
                        chestLog(`updateViewerNoticeBar: API correction - baseline was ${viewerDropBaseline}, API shows ${apiLikes}`);
                    }

                    const newLikesForNextDrop = Math.max(0, apiLikes - viewerDropBaseline);
                    const hasEnoughForNextDrop = newLikesForNextDrop >= threshold;

                    chestLog(`updateViewerNoticeBar (animation - API): apiLikes=${apiLikes}, baseline=${viewerDropBaseline}, newLikes=${newLikesForNextDrop}`);

                    // Display logic:
                    // - 0 likes: just "0/X likes" (no status)
                    // - > 0 but < threshold: "X/Y Dropping..."
                    // - >= threshold: "X/Y Queued"
                    if (hasEnoughForNextDrop) {
                        logStatusBarUpdate('VIEWER', newLikesForNextDrop, threshold, 'Queued', 'animation - API polling');
                        noticeBar.innerHTML = `
                            <span>Chest auto-drop enabled:</span>
                            <span style="font-weight: 600;">
                                ${newLikesForNextDrop.toLocaleString()} / ${threshold.toLocaleString()} likes
                            </span>
                            <span style="color: var(--color-mediumgray, #888);">|</span>
                            <span style="color: var(--color-white, #fff);">
                                Queued
                            </span>
                        `;
                    } else if (newLikesForNextDrop > 0) {
                        logStatusBarUpdate('VIEWER', newLikesForNextDrop, threshold, 'Dropping...', 'animation - API polling');
                        noticeBar.innerHTML = `
                            <span>Chest auto-drop enabled:</span>
                            <span style="font-weight: 600;">
                                ${newLikesForNextDrop.toLocaleString()} / ${threshold.toLocaleString()} likes
                            </span>
                            <span style="color: var(--color-mediumgray, #888);">|</span>
                            <span style="color: var(--color-white, #fff);">
                                Dropping...
                            </span>
                        `;
                    } else {
                        logStatusBarUpdate('VIEWER', newLikesForNextDrop, threshold, '', 'animation - API polling');
                        noticeBar.innerHTML = `
                            <span>Chest auto-drop enabled:</span>
                            <span style="font-weight: 600;">
                                ${newLikesForNextDrop.toLocaleString()} / ${threshold.toLocaleString()} likes
                            </span>
                        `;
                    }
                    noticeBar.style.display = 'flex';
                }
            });
            // Return immediately - the async fetch will update the display
            return;
        }

        // After 3 seconds, use audience list
        const currentLikes = getAudienceLikes();

        // Use local baseline if we have it, otherwise fall back to Firebase (for viewers who joined mid-animation)
        const baseline = viewerDropBaseline > 0 ? viewerDropBaseline : settings.lastChestOpenLikes;
        const newLikesForNextDrop = Math.max(0, currentLikes - baseline);
        const hasEnoughForNextDrop = newLikesForNextDrop >= threshold;

        chestLog(`updateViewerNoticeBar (animation): currentLikes=${currentLikes}, baseline=${baseline}, newLikes=${newLikesForNextDrop}`);

        // Display logic:
        // - 0 likes: just "0/X likes" (no status)
        // - > 0 but < threshold: "X/Y Dropping..."
        // - >= threshold: "X/Y Queued"
        if (hasEnoughForNextDrop) {
            logStatusBarUpdate('VIEWER', newLikesForNextDrop, threshold, 'Queued', 'animation playing');
            noticeBar.innerHTML = `
                <span>Chest auto-drop enabled:</span>
                <span style="font-weight: 600;">
                    ${newLikesForNextDrop.toLocaleString()} / ${threshold.toLocaleString()} likes
                </span>
                <span style="color: var(--color-mediumgray, #888);">|</span>
                <span style="color: var(--color-white, #fff);">
                    Queued
                </span>
            `;
        } else if (newLikesForNextDrop > 0) {
            logStatusBarUpdate('VIEWER', newLikesForNextDrop, threshold, 'Dropping...', 'animation playing');
            noticeBar.innerHTML = `
                <span>Chest auto-drop enabled:</span>
                <span style="font-weight: 600;">
                    ${newLikesForNextDrop.toLocaleString()} / ${threshold.toLocaleString()} likes
                </span>
                <span style="color: var(--color-mediumgray, #888);">|</span>
                <span style="color: var(--color-white, #fff);">
                    Dropping...
                </span>
            `;
        } else {
            logStatusBarUpdate('VIEWER', newLikesForNextDrop, threshold, '', 'animation playing');
            noticeBar.innerHTML = `
                <span>Chest auto-drop enabled:</span>
                <span style="font-weight: 600;">
                    ${newLikesForNextDrop.toLocaleString()} / ${threshold.toLocaleString()} likes
                </span>
            `;
        }
        noticeBar.style.display = 'flex';
        return;
    }

    // Calculate likes locally from audience list
    const currentLikes = getAudienceLikes();
    const likesInChest = Math.max(0, currentLikes - settings.lastChestOpenLikes);

    // Check if threshold reached
    const hasEnoughForDrop = likesInChest >= threshold;

    // Check if broadcaster is awaiting confirmation
    if (hasEnoughForDrop && settings.awaitingConfirmation) {
        logStatusBarUpdate('VIEWER', likesInChest, threshold, 'Awaiting broadcaster', 'broadcaster confirming');
        noticeBar.innerHTML = `
            <span>Chest auto-drop enabled:</span>
            <span style="font-weight: 600;">
                ${likesInChest.toLocaleString()} / ${threshold.toLocaleString()} likes
            </span>
            <span style="color: var(--color-mediumgray, #888);">|</span>
            <span>Awaiting broadcaster</span>
        `;
        noticeBar.style.display = 'flex';
        return;
    }

    if (hasEnoughForDrop) {
        // Not in animation, trigger countdown fetch
        if (!viewerWaitingForCountdown) {
            chestLog('updateViewerNoticeBar: Threshold reached locally, waiting 3s to fetch countdown...');
            viewerWaitingForCountdown = true;

            // Show "Queued" while waiting
            logStatusBarUpdate('VIEWER', likesInChest, threshold, 'Queued', 'threshold reached, fetching countdown');
            noticeBar.innerHTML = `
                <span>Chest auto-drop enabled:</span>
                <span style="font-weight: 600;">
                    ${likesInChest.toLocaleString()} / ${threshold.toLocaleString()} likes
                </span>
                <span style="color: var(--color-mediumgray, #888);">|</span>
                <span style="color: var(--color-white, #fff);">
                    Queued
                </span>
            `;
            noticeBar.style.display = 'flex';

            // Wait 3 seconds then fetch Firebase for timestamp
            setTimeout(async () => {
                await onViewerThresholdReached();
            }, 3000);
            return;
        }
    }

    // Show status while waiting for countdown
    if (viewerWaitingForCountdown) {
        // Check if broadcaster is awaiting confirmation
        if (settings.awaitingConfirmation) {
            logStatusBarUpdate('VIEWER', likesInChest, threshold, 'Awaiting broadcaster', 'waiting for confirmation');
            noticeBar.innerHTML = `
                <span>Chest auto-drop enabled:</span>
                <span style="font-weight: 600;">
                    ${likesInChest.toLocaleString()} / ${threshold.toLocaleString()} likes
                </span>
                <span style="color: var(--color-mediumgray, #888);">|</span>
                <span style="color: var(--color-white, #fff);">
                    Awaiting broadcaster
                </span>
            `;
        } else {
            logStatusBarUpdate('VIEWER', likesInChest, threshold, 'Queued', 'waiting for countdown');
            noticeBar.innerHTML = `
                <span>Chest auto-drop enabled:</span>
                <span style="font-weight: 600;">
                    ${likesInChest.toLocaleString()} / ${threshold.toLocaleString()} likes
                </span>
                <span style="color: var(--color-mediumgray, #888);">|</span>
                <span style="color: var(--color-white, #fff);">
                    Queued
                </span>
            `;
        }
        noticeBar.style.display = 'flex';
        return;
    }

    // Normal display - show current progress
    logStatusBarUpdate('VIEWER', likesInChest, threshold, 'progress');
    noticeBar.innerHTML = `
        <span>Chest auto-drop enabled:</span>
        <span style="font-weight: 600;">
            ${likesInChest.toLocaleString()} / ${threshold.toLocaleString()} likes
        </span>
    `;

    noticeBar.style.display = 'flex';
}

// Track if viewer is waiting to fetch countdown
let viewerWaitingForCountdown = false;
// Track if viewer countdown finished and waiting for animation to start
let viewerWaitingForAnimation = false;
// Track the current drop amount (from countdown) - survives into animation phase
let viewerCurrentDropLikes = 0;
// Track the baseline likes at moment of drop (for calculating new likes before settings update)
let viewerDropBaseline = 0;
// Track when to stop API polling after drop (first 3 seconds)
let viewerApiPollingEndTime = 0;

// Called when viewer locally detects threshold reached, after 3s delay
async function onViewerThresholdReached() {
    chestLog('=== VIEWER: onViewerThresholdReached ===');
    chestLog('onViewerThresholdReached: Fetching Firebase for timestamp...');

    // Clear cache and fetch fresh data
    broadcasterChestSettings = null;
    const broadcasterId = await getBroadcasterUserId();
    if (broadcasterId) {
        broadcastersWithNoSettings.delete(broadcasterId); // Allow refetch
    }
    await loadBroadcasterChestSettings();

    // Check if broadcaster is awaiting confirmation
    if (broadcasterChestSettings && broadcasterChestSettings.awaitingConfirmation) {
        chestLog('onViewerThresholdReached: Broadcaster awaiting confirmation');
        // Keep viewerWaitingForCountdown = true so we stay in waiting state
        // The realtime listener or next fetch will update us when broadcaster confirms
        updateViewerNoticeBar();
        return;
    }

    if (!broadcasterChestSettings || !broadcasterChestSettings.chestDropStartTime) {
        chestLog('onViewerThresholdReached: No chestDropStartTime in Firebase');
        // Keep viewerWaitingForCountdown = true so we don't re-trigger immediately
        // The realtime listener will update us when broadcaster starts the drop
        // Or likes changing will re-check after the next threshold cross
        updateViewerNoticeBar();
        return;
    }

    const dropStartTime = broadcasterChestSettings.chestDropStartTime;
    const expectedDropTime = dropStartTime + CHEST_DROP_TOTAL_DELAY_MS;
    const now = Date.now();
    const timeUntilDrop = expectedDropTime - now;

    chestLog(`onViewerThresholdReached: Got chestDropStartTime=${dropStartTime} (${new Date(dropStartTime).toLocaleTimeString()})`);
    chestLog(`onViewerThresholdReached: Expected drop at ${new Date(expectedDropTime).toLocaleTimeString()}`);
    chestLog(`onViewerThresholdReached: Time until drop: ${(timeUntilDrop/1000).toFixed(1)}s`);

    // Start countdown
    viewerWaitingForCountdown = false;
    startViewerCountdown();
}

// Start viewer countdown using Firebase timestamp
function startViewerCountdown() {
    if (viewerCountdownActive) return;

    viewerCountdownActive = true;
    const settings = broadcasterChestSettings;
    const dropStartTime = settings.chestDropStartTime;
    const threshold = settings.threshold;
    const lastChestOpenLikes = settings.lastChestOpenLikes;

    // Track API-fetched likes for last 3 seconds of countdown
    let apiLikes = null;
    let apiFetchStarted = false;

    chestLog('=== VIEWER: startViewerCountdown ===');
    chestLog(`startViewerCountdown: dropStartTime=${dropStartTime} (${new Date(dropStartTime).toLocaleTimeString()})`);
    chestLog(`startViewerCountdown: lastChestOpenLikes=${lastChestOpenLikes}`);

    const noticeBar = document.getElementById('betternow-notice-bar') || createNoticeBar();
    if (!noticeBar) {
        viewerCountdownActive = false;
        return;
    }

    let countdownLock = false; // Prevent overlapping async calls

    viewerCountdownInterval = setInterval(async () => {
        // Skip if previous iteration still running
        if (countdownLock) return;
        countdownLock = true;

        try {
            const elapsed = Date.now() - dropStartTime;
            const remaining = Math.max(0, CHEST_DROP_TOTAL_DELAY_MS - elapsed);
            const secondsRemaining = Math.ceil(remaining / 1000);

            // During last 3 seconds, use API for accurate likes count
            // (audience list has delay, API has real-time data)
            let currentLikes;
            if (remaining <= 3000 && remaining > 0) {
                // Fetch from API (with rate limiting built in)
                const fetchedLikes = await fetchBroadcastLikesFromAPI();
                if (fetchedLikes !== null) {
                    apiLikes = fetchedLikes;
                    currentLikes = apiLikes;
                    if (!apiFetchStarted) {
                        chestLog('startViewerCountdown: Switching to API for last 3 seconds');
                        apiFetchStarted = true;
                    }
                } else {
                    currentLikes = getAudienceLikes();
                }
            } else {
                currentLikes = getAudienceLikes();
            }

            const likesInChest = Math.max(0, currentLikes - lastChestOpenLikes);

            if (remaining <= 0) {
                // Countdown finished - chest should be dropping now
                clearInterval(viewerCountdownInterval);
                viewerCountdownInterval = null;
                viewerCountdownActive = false;
                viewerWaitingForAnimation = true; // Prevent re-triggering until animation starts

                // Use API likes if we have them (more accurate), otherwise use audience
                const finalLikes = apiLikes !== null ? apiLikes : currentLikes;
                const finalLikesInChest = Math.max(0, finalLikes - lastChestOpenLikes);

                // Store the final amount and current likes as baseline for tracking new likes
                viewerCurrentDropLikes = finalLikesInChest;
                viewerDropBaseline = finalLikes; // New baseline for tracking post-drop likes

                // Start API polling for the first 3 seconds of animation
                viewerApiPollingEndTime = Date.now() + 3000;

                chestLog('=== VIEWER: Countdown reached 0 ===');
                chestLog(`startViewerCountdown: elapsed=${elapsed}ms, remaining=${remaining}ms`);
                chestLog(`startViewerCountdown: viewerDropBaseline set to ${viewerDropBaseline} (from ${apiLikes !== null ? 'API' : 'audience'})`);
                chestLog('startViewerCountdown: Countdown ended, waiting for animation');

                // Show 0 likes - the drop just happened, new likes will accumulate from here
                // No status text - viewers see the animation and know it's dropping
                logStatusBarUpdate('VIEWER', 0, threshold, '', 'countdown finished');
                noticeBar.innerHTML = `
                    <span>Chest auto-drop enabled:</span>
                    <span style="font-weight: 600;">
                        0 / ${threshold.toLocaleString()} likes
                    </span>
                `;
                noticeBar.style.display = 'flex';

                return;
            }

            // Show countdown with LIVE likes count
            logStatusBarUpdate('VIEWER', likesInChest, threshold, `Dropping in ${secondsRemaining}s`, 'countdown');
            noticeBar.innerHTML = `
                <span>Chest auto-drop enabled:</span>
                <span style="font-weight: 600;">
                    ${likesInChest.toLocaleString()} / ${threshold.toLocaleString()} likes
                </span>
                <span style="color: var(--color-mediumgray, #888);">|</span>
                <span style="color: var(--color-white, #fff);">
                    Dropping in ${secondsRemaining}s
                </span>
            `;
            noticeBar.style.display = 'flex';
        } finally {
            countdownLock = false;
        }
    }, 100);

    chestLog('startViewerCountdown: Countdown started');
}

// Clear cached broadcaster settings (call on navigation)
function clearBroadcasterChestSettings() {
    broadcasterChestSettings = null;
}

async function openChest(currentLikes) {
    isOpeningChest = true;
    const startTime = Date.now();
    chestLog('=== BROADCASTER: openChest START ===');
    chestLog(`openChest: currentLikes=${currentLikes}, lastChestOpenLikes=${lastChestOpenLikes}`);

    // Track initial values - DON'T update lastChestOpenLikes yet!
    // It will be updated AFTER the drop completes so likesInChest keeps tracking correctly during countdown
    const dropBaselineLikes = lastChestOpenLikes; // Remember where we started
    likesBeingDropped = currentLikes - dropBaselineLikes; // Initial amount (will update during countdown)
    chestOpenCount++;
    lastChestOpenTime = new Date().toISOString();

    chestLog(`openChest: likesBeingDropped=${likesBeingDropped}`);

    // Set timestamp NOW - this is when threshold was reached
    // Viewers will see: countdown ends at chestDropStartTime + CHEST_DROP_TOTAL_DELAY_MS
    // Broadcaster will: wait (TOTAL - UI_INTERACTION) then click through UI
    // This way animation starts at roughly the same time for both
    chestDropStartTime = Date.now();

    const broadcasterWaitTime = CHEST_DROP_TOTAL_DELAY_MS - CHEST_UI_INTERACTION_MS;
    const expectedAnimationTime = chestDropStartTime + CHEST_DROP_TOTAL_DELAY_MS;

    chestLog(`openChest: Set chestDropStartTime=${chestDropStartTime} (${new Date(chestDropStartTime).toLocaleTimeString()})`);
    chestLog(`openChest: Viewer countdown ends at ${new Date(expectedAnimationTime).toLocaleTimeString()}`);
    chestLog(`openChest: Broadcaster will start clicking at ${new Date(chestDropStartTime + broadcasterWaitTime).toLocaleTimeString()}`);

    // Save to Firebase immediately so viewers can fetch and calculate countdown
    chestLog('openChest: Saving timestamp to Firebase...');
    saveChestSettingsLocal();

    // Start broadcaster countdown (will show "Dropping in Xs" in notice bar)
    isChestCountingDown = true;
    startBroadcasterCountdown();

    chestLog(`openChest: Waiting ${broadcasterWaitTime/1000}s before clicking (${CHEST_UI_INTERACTION_MS/1000}s reserved for UI)...`);

    // Wait for the adjusted delay (TOTAL - UI_INTERACTION time)
    // This gives us time to click through the UI so animation starts when viewer countdown ends
    await new Promise(resolve => setTimeout(resolve, broadcasterWaitTime));

    chestLog('openChest: Wait complete, attempting to drop chest');
    isChestCountingDown = false;
    stopBroadcasterCountdown();

    // Set up animation verification BEFORE making API call
    // (animation may start during the API call, before it returns)
    const apiCallTime = Date.now();
    const animationStarted = new Promise(resolve => {
        animationStartedResolver = resolve;
    });
    const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 5000));

    // Try API call first - this is more reliable than simulating clicks
    chestLog('openChest: Trying API call to open chest...');
    const apiSuccess = await callChestOpenAPI();

    if (apiSuccess) {
        chestLog('openChest: API call successful!');

        // NOW update lastChestOpenLikes to current likes (drop is happening)
        // This captures any additional likes that came in during countdown
        const finalDropLikes = getCurrentLikes();
        const actualDropAmount = finalDropLikes - dropBaselineLikes;
        lastChestOpenLikes = finalDropLikes;
        likesBeingDropped = actualDropAmount;

        chestLog(`openChest: Dropped ${actualDropAmount.toLocaleString()} likes. lastChestOpenLikes: ${dropBaselineLikes.toLocaleString()} → ${lastChestOpenLikes.toLocaleString()}`);

        // Save updated values to Firebase
        saveChestSettingsLocal();

        // Note: Don't set isChestAnimationPlaying here - let the observer set it when animation actually starts
        updateNoticeBar();

        // Wait for animation to start (observer will resolve this)
        const result = await Promise.race([animationStarted, timeout]);

        if (result === 'timeout') {
            animationStartedResolver = null; // Clean up
            chestWarn('openChest: API returned success but animation did not start within 5 seconds');
            // Double-check with server
            const username = window.location.pathname.split('/')[1];
            if (username) {
                try {
                    const verifyResponse = await fetch(`https://api.younow.com/php/api/broadcast/info/curId=0/lang=en/user=${username}`, {
                        credentials: 'include'
                    });
                    const verifyData = await verifyResponse.json();
                    const serverLikes = verifyData.propsChest?.likes || 0;
                    chestWarn(`openChest: Server currently shows ${serverLikes} likes in chest`);
                } catch (e) {
                    chestWarn('openChest: Could not verify with server:', e);
                }
            }
        } else {
            const verifyTime = Date.now() - apiCallTime;
            chestLog(`openChest: Verified - animation started ${verifyTime}ms after API call`);
        }

        const duration = Date.now() - startTime;
        chestLog(`openChest: Sequence complete in ${duration}ms (via API)`);

        await new Promise(resolve => setTimeout(resolve, 500));
        isOpeningChest = false;
        return;
    }

    // API failed - clean up the resolver
    animationStartedResolver = null;

    // API failed - fall back to UI clicking
    chestWarn('openChest: API call failed, falling back to UI clicks');

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
            simulateClick(chestButton);

            // Wait for modal to appear (2 seconds to let YouNow process)
            await new Promise(resolve => setTimeout(resolve, 2000));

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
        simulateClick(openButton);

        // Wait 2 seconds before looking for Make it Rain (let YouNow process Open click)
        await new Promise(resolve => setTimeout(resolve, 2000));

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

    // NOW click Make it Rain - this is the critical one that triggers the server-side drop
    chestLog('=== BROADCASTER: Clicking Make it Rain NOW ===');
    simulateClick(makeItRainBtn);

    // Mark animation as playing - cooldown will be set when animation ends
    isChestAnimationPlaying = true;

    // NOW update lastChestOpenLikes to current likes (drop is happening)
    // This captures any additional likes that came in during countdown
    const finalDropLikes = getCurrentLikes();
    const actualDropAmount = finalDropLikes - dropBaselineLikes;
    lastChestOpenLikes = finalDropLikes;
    likesBeingDropped = actualDropAmount;

    chestLog(`openChest: Chest dropped! ${actualDropAmount.toLocaleString()} likes. lastChestOpenLikes: ${dropBaselineLikes.toLocaleString()} → ${lastChestOpenLikes.toLocaleString()}, session total: ${chestOpenCount}`);

    // Save updated values to Firebase
    saveChestSettingsLocal();

    // Update notice bar to show reset progress
    updateNoticeBar();

    // Wait 2 seconds for the chest animation/modal transition (let YouNow register the drop)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify the drop was actually processed by checking the API
    const username = window.location.pathname.split('/')[1];
    if (username) {
        try {
            const verifyResponse = await fetch(`https://api.younow.com/php/api/broadcast/info/curId=0/lang=en/user=${username}`, {
                credentials: 'include'
            });
            const verifyData = await verifyResponse.json();
            const serverLikes = verifyData.propsChest?.likes || 0;

            if (serverLikes > 100) {
                // Drop may not have registered - server still shows likes
                chestWarn(`openChest: Server still shows ${serverLikes} likes in chest - drop may not have registered!`);
                chestWarn('openChest: Will retry verification after animation completes');
            } else {
                chestLog(`openChest: Verified drop success - server shows ${serverLikes} likes in chest`);
            }
        } catch (e) {
            chestWarn('openChest: Could not verify drop via API:', e);
        }
    }

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
        simulateClick(tellButton);
    } else {
        chestWarn('openChest: Tell Them button not found (non-critical)');
    }

    const duration = Date.now() - startTime;
    chestLog(`openChest: Sequence complete in ${duration}ms`);

    // Wait a bit before allowing another check
    await new Promise(resolve => setTimeout(resolve, 500));
    isOpeningChest = false;
}

// Broadcaster countdown state
let isChestCountingDown = false;
let broadcasterCountdownInterval = null;

function startBroadcasterCountdown() {
    if (broadcasterCountdownInterval) return;

    broadcasterCountdownInterval = setInterval(() => {
        updateNoticeBar();
    }, 100); // Update frequently for smooth countdown
}

function stopBroadcasterCountdown() {
    if (broadcasterCountdownInterval) {
        clearInterval(broadcasterCountdownInterval);
        broadcasterCountdownInterval = null;
    }
}

// Delay measurement: periodic API polling
let delayMeasurementInterval = null;

function startDelayMeasurementPolling() {
    if (!delayMeasurementEnabled || delayMeasurementInterval) return;

    chestLog('startDelayMeasurementPolling: Starting API polling for delay measurement');
    delayMeasurementInterval = setInterval(() => {
        fetchBroadcastLikesFromAPI(); // This logs API values when they change
    }, 1000); // Poll every second
}

function stopDelayMeasurementPolling() {
    if (delayMeasurementInterval) {
        clearInterval(delayMeasurementInterval);
        delayMeasurementInterval = null;
    }
}

function startChestMonitoring() {
    chestLog('startChestMonitoring: Starting audience observer');

    // Stop existing observers
    stopChestMonitoring();

    // Sync with YouNow API to get accurate chest state
    syncChestIfNeeded();

    // Start delay measurement polling if enabled
    if (delayMeasurementEnabled) {
        startDelayMeasurementPolling();
    }

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

                // For delay measurement: also fetch API to compare timestamps
                if (delayMeasurementEnabled) {
                    fetchBroadcastLikesFromAPI(); // This will log the API value
                }

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

// Track last animation state change time for debouncing
let lastAnimationStartTime = 0;
let lastAnimationEndTime = 0;
const ANIMATION_DEBOUNCE_MS = 500; // Ignore animation events within 500ms of each other

function setupChestAnimationObserver() {
    if (chestAnimationObserver) return;

    chestAnimationObserver = new MutationObserver((mutations) => {
        const now = Date.now();

        for (const mutation of mutations) {
            // Check for animation ADDED (chest drop started)
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches?.('app-chest-lottie') || node.querySelector?.('app-chest-lottie')) {
                        // Debounce: ignore if animation just ended (DOM flicker)
                        if (now - lastAnimationEndTime < ANIMATION_DEBOUNCE_MS) {
                            chestLog('Chest animation start ignored (debounced - too close to last end)');
                            return;
                        }

                        // Ignore if animation is already playing (DOM re-render flicker)
                        if (isChestAnimationPlaying) {
                            chestLog('Chest animation start ignored (animation already playing - likely DOM re-render)');
                            // Still resolve the promise if it's pending - the animation IS playing
                            if (animationStartedResolver) {
                                chestLog('Chest animation: Resolving pending promise even though flag was already set');
                                animationStartedResolver();
                                animationStartedResolver = null;
                            }
                            return;
                        }

                        chestLog('Chest animation started');
                        isChestAnimationPlaying = true;
                        lastAnimationStartTime = now;

                        // Resolve any pending API verification promise
                        if (animationStartedResolver) {
                            animationStartedResolver();
                            animationStartedResolver = null;
                        }

                        // If we didn't trigger this (manual drop), reset the counter
                        if (!isOpeningChest) {
                            const currentLikes = getCurrentLikes();
                            chestLog('Manual chest drop detected, resetting counter at', currentLikes.toLocaleString(), 'likes');
                            lastChestOpenLikes = currentLikes;
                            chestOpenCount++;
                            lastChestOpenTime = new Date().toISOString();
                            saveChestSettingsLocal();
                            saveChestSettingsToFirebase();
                        }

                        // Update notice bar (shows likes progress, "Queued" if threshold met)
                        updateNoticeBar();
                        return;
                    }
                }
            }

            // Check for animation REMOVED (chest drop finished)
            for (const node of mutation.removedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches?.('app-chest-lottie') || node.querySelector?.('app-chest-lottie')) {
                        // Debounce: ignore if animation just started (DOM flicker)
                        if (now - lastAnimationStartTime < ANIMATION_DEBOUNCE_MS) {
                            chestLog('Chest animation end ignored (debounced - too close to last start, likely DOM flicker)');
                            return;
                        }

                        chestLog('Chest animation ended');
                        isChestAnimationPlaying = false;
                        lastAnimationEndTime = now;

                        // Clear drop state - the drop is complete
                        likesBeingDropped = 0;
                        chestDropStartTime = 0;

                        // Save to Firebase so viewers clear their countdown state
                        saveChestSettingsToFirebase();

                        // Check if we already have enough likes for another drop
                        const currentLikes = getCurrentLikes();
                        const likesInChest = currentLikes - lastChestOpenLikes;

                        if (autoChestEnabled && isBroadcasting() && autoChestThreshold && likesInChest >= autoChestThreshold) {
                            // Already at threshold! Start countdown for next drop
                            chestLog('Post-animation: Already at threshold, starting 15s countdown');
                            startPostAnimationCountdown(currentLikes);
                        } else {
                            updateNoticeBar();
                        }

                        return;
                    }
                }
            }
        }
    });

    chestAnimationObserver.observe(document.body, { childList: true, subtree: true });
    chestLog('setupChestAnimationObserver: Watching for chest animation start/end');

    // Check if animation is already playing (element exists in DOM before observer was set up)
    // BUT don't override if animation just ended recently (DOM cleanup can be slow)
    if (document.querySelector('app-chest-lottie')) {
        const now = Date.now();
        const timeSinceAnimationEnd = now - lastAnimationEndTime;

        // If animation ended within last 5 seconds, don't trust the DOM - it's probably stale
        if (lastAnimationEndTime > 0 && timeSinceAnimationEnd < 5000) {
            chestLog(`setupChestAnimationObserver: Animation element in DOM but animation ended ${timeSinceAnimationEnd}ms ago, ignoring`);
        } else {
            chestLog('setupChestAnimationObserver: Animation element already in DOM, setting isChestAnimationPlaying=true');
            isChestAnimationPlaying = true;
        }
    }
}

function stopChestAnimationObserver() {
    if (chestAnimationObserver) {
        chestAnimationObserver.disconnect();
        chestAnimationObserver = null;
    }
}

// Start countdown after animation ends (reuses same 15s countdown as initial drop)
async function startPostAnimationCountdown(currentLikes) {
    chestLog('startPostAnimationCountdown: Starting post-animation countdown');

    // openChest will handle the timestamp, countdown display, and waiting
    // It uses the adjusted timing (TOTAL - UI_INTERACTION) to account for clicking
    await openChest(currentLikes);
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
    stopDelayMeasurementPolling();
    stopChestAnimationObserver();
}

async function checkBroadcastStatus() {
    const broadcasting = isBroadcasting();
    chestLog('checkBroadcastStatus: broadcasting =', broadcasting, ', autoChestEnabled =', autoChestEnabled);

    if (broadcasting) {
        // Broadcaster mode - show controls and monitor
        createChestControls();
        stopViewerMonitoring(); // Stop viewer mode if was running
        if (autoChestEnabled) {
            // Sync with YouNow API to get accurate chest state
            await syncChestIfNeeded();

            // Check if threshold is already exceeded
            if (autoChestThreshold && autoChestThreshold > 0) {
                const currentLikes = getCurrentLikes();
                const likesInChest = currentLikes - lastChestOpenLikes;

                if (likesInChest >= autoChestThreshold) {
                    // Threshold already met - set awaiting confirmation state
                    chestLog('checkBroadcastStatus: Threshold already met, awaiting confirmation');
                    awaitingDropConfirmation = true;
                    saveChestSettingsLocal();
                }
            }

            startChestMonitoring();
        }
    } else {
        // Viewer mode - check if broadcaster has auto-chest enabled
        removeChestControls();
        stopChestMonitoring();
        startViewerMonitoring();
    }
}

// ============ Viewer Monitoring ============
// For viewers: load settings from Firebase once, then update notice bar locally
// as audience list changes. Refresh lastChestOpenLikes when chest drops.

let viewerModeActive = false;
let viewerChestEnabledUnsubscribe = null;
let viewerEnabledDebounceTimer = null;
const VIEWER_ENABLED_DEBOUNCE_MS = 1500; // Wait 1.5s for rapid toggles to settle

async function startViewerMonitoring() {
    if (viewerModeActive) return; // Already in viewer mode

    // Check global kill switch (admins and users with explicit grant bypass)
    const isAdmin = typeof ADMIN_USER_IDS !== 'undefined' && ADMIN_USER_IDS.includes(currentUserId);
    const hasExplicitGrant = typeof grantedFeatures !== 'undefined' && grantedFeatures[currentUserId]?.includes('autoChest');
    if (!isAdmin && !hasExplicitGrant && typeof globalAutoChestEnabled !== 'undefined' && !globalAutoChestEnabled) {
        chestLog('startViewerMonitoring: Auto Chest globally disabled by admin');
        return;
    }

    // Check if user has access to autoChest feature
    if (typeof userHasFeature === 'function' && !userHasFeature('autoChest')) {
        chestLog('startViewerMonitoring: User does not have autoChest feature, skipping');
        return;
    }

    // Check if we're on a live broadcast
    const isLive = document.querySelector('.broadcaster-is-online');
    if (!isLive) {
        chestLog('startViewerMonitoring: Not on a live broadcast');
        return;
    }

    viewerModeActive = true;
    chestLog('startViewerMonitoring: Starting viewer monitoring');

    // Get broadcaster ID for subscriptions
    const broadcasterId = await getBroadcasterUserId();

    // Subscribe to chestEnabled realtime updates (fires when broadcaster enables/disables or awaitingConfirmation changes)
    if (broadcasterId && typeof subscribeToChestEnabled === 'function') {
        chestLog('startViewerMonitoring: Subscribing to chestEnabled for', broadcasterId);
        viewerChestEnabledUnsubscribe = subscribeToChestEnabled(broadcasterId, async (enabledData) => {
            // Debounce rapid toggles - wait for broadcaster to settle
            if (viewerEnabledDebounceTimer) {
                clearTimeout(viewerEnabledDebounceTimer);
            }

            viewerEnabledDebounceTimer = setTimeout(async () => {
                viewerEnabledDebounceTimer = null;

                if (enabledData && enabledData.enabled) {
                    chestLog('startViewerMonitoring: Broadcaster has chest enabled, awaitingConfirmation:', enabledData.awaitingConfirmation, 'chestDropStartTime:', enabledData.chestDropStartTime, 'likesBeingDropped:', enabledData.likesBeingDropped);

                    // Update broadcasterChestSettings with data from chestEnabled
                    // This avoids needing to refetch chestSettings for awaitingConfirmation changes
                    if (!broadcasterChestSettings) {
                        broadcastersWithNoSettings.delete(broadcasterId);
                        await loadBroadcasterChestSettings();
                    }

                    // Always update from realtime data
                    if (broadcasterChestSettings) {
                        broadcasterChestSettings.awaitingConfirmation = enabledData.awaitingConfirmation || false;
                        broadcasterChestSettings.threshold = enabledData.threshold || broadcasterChestSettings.threshold;
                        broadcasterChestSettings.chestDropStartTime = enabledData.chestDropStartTime || 0;
                        broadcasterChestSettings.likesBeingDropped = enabledData.likesBeingDropped || 0;
                    }

                    // If we received a chestDropStartTime and countdown hasn't started, start it now
                    // But DON'T start countdown if animation is already playing
                    if (enabledData.chestDropStartTime && enabledData.chestDropStartTime > 0 && !viewerCountdownActive && !viewerAnimationPlaying) {
                        const now = Date.now();
                        const expectedDropTime = enabledData.chestDropStartTime + CHEST_DROP_TOTAL_DELAY_MS;
                        const timeUntilDrop = expectedDropTime - now;

                        // Only start if countdown hasn't expired yet
                        if (timeUntilDrop > 0) {
                            chestLog('startViewerMonitoring: Received chestDropStartTime via realtime, starting countdown');
                            viewerWaitingForCountdown = false;
                            startViewerCountdown();
                            return; // startViewerCountdown will update the notice bar
                        }
                    }

                    updateViewerNoticeBar();
                } else {
                    chestLog('startViewerMonitoring: Broadcaster chest not enabled');
                    broadcasterChestSettings = null;
                    updateViewerNoticeBar();
                }
            }, VIEWER_ENABLED_DEBOUNCE_MS);
        });
    } else {
        // Fallback: just load settings once if realtime not available
        chestLog('startViewerMonitoring: Realtime not available, loading settings once');
        await loadBroadcasterChestSettings();
    }

    // Initial notice bar update
    updateViewerNoticeBar();

    // Watch audience list for any like changes - update notice bar locally
    const audienceList = document.querySelector('app-audience');
    if (audienceList && !viewerAudienceObserver) {
        viewerAudienceObserver = new MutationObserver(() => {
            // Just update the notice bar - it reads likes locally and detects threshold
            updateViewerNoticeBar();
        });

        viewerAudienceObserver.observe(audienceList, {
            childList: true,
            subtree: true,
            characterData: true
        });

        chestLog('startViewerMonitoring: Watching audience for like changes');
    } else if (!audienceList) {
        chestLog('startViewerMonitoring: Audience list not found');
    }

    // Watch for chest animation start/end to update notice bar
    if (!viewerAnimationObserver) {
        viewerAnimationObserver = new MutationObserver((mutations) => {
            const now = Date.now();

            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches?.('app-chest-lottie') || node.querySelector?.('app-chest-lottie')) {
                            // Debounce: ignore if animation just ended (DOM flicker)
                            if (now - viewerLastAnimationEndTime < ANIMATION_DEBOUNCE_MS) {
                                chestLog('=== VIEWER: Animation START ignored (debounced) ===');
                                return;
                            }

                            // Ignore if animation is already playing (DOM re-render flicker)
                            if (viewerAnimationPlaying) {
                                chestLog('=== VIEWER: Animation START ignored (already playing - DOM re-render) ===');
                                return;
                            }

                            viewerAnimationPlaying = true;
                            chestLog('=== VIEWER: Animation STARTED (app-chest-lottie added) ===');
                            viewerLastAnimationStartTime = now;
                            viewerWaitingForAnimation = false; // Animation started, clear flag

                            // Stop any running countdown - animation has started
                            if (viewerCountdownInterval) {
                                chestLog('VIEWER: Stopping countdown - animation already started');
                                clearInterval(viewerCountdownInterval);
                                viewerCountdownInterval = null;
                                viewerCountdownActive = false;
                            }

                            // Note: If viewerDropBaseline is 0 (viewer joined mid-animation),
                            // updateViewerNoticeBar will fall back to Firebase's lastChestOpenLikes

                            // Safety timeout - force reset if animation stuck (YouNow glitch)
                            const animationStartTime = now;
                            setTimeout(() => {
                                if (viewerAnimationPlaying && viewerLastAnimationStartTime === animationStartTime) {
                                    chestWarn('VIEWER: Animation stuck for 35s+, forcing reset');
                                    viewerAnimationPlaying = false;
                                    viewerDropBaseline = 0;
                                    viewerApiPollingEndTime = 0;
                                    viewerCurrentDropLikes = 0;
                                    updateViewerNoticeBar();
                                }
                            }, 35000);

                            // Update display
                            updateViewerNoticeBar();
                            return;
                        }
                    }
                }
                for (const node of mutation.removedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches?.('app-chest-lottie') || node.querySelector?.('app-chest-lottie')) {
                            // Debounce: ignore if animation just started (DOM flicker)
                            if (now - viewerLastAnimationStartTime < ANIMATION_DEBOUNCE_MS) {
                                chestLog('=== VIEWER: Animation END ignored (debounced - likely DOM flicker) ===');
                                return;
                            }

                            chestLog('=== VIEWER: Animation ENDED (app-chest-lottie removed) ===');
                            viewerLastAnimationEndTime = now;
                            viewerAnimationPlaying = false;
                            viewerDropBaseline = 0; // Reset baseline for next cycle
                            viewerApiPollingEndTime = 0; // Stop API polling
                            viewerCurrentDropLikes = 0; // Clear for next cycle
                            viewerWaitingForCountdown = false; // Reset waiting state after animation

                            // Refresh Firebase to get new lastChestOpenLikes immediately
                            broadcasterChestSettings = null;
                            getBroadcasterUserId().then(bid => {
                                if (bid) broadcastersWithNoSettings.delete(bid);
                            });
                            loadBroadcasterChestSettings().then(() => {
                                // Check if threshold still met - if so, start countdown immediately
                                const currentLikes = getAudienceLikes();
                                const settings = broadcasterChestSettings;
                                if (settings) {
                                    const likesInChest = Math.max(0, currentLikes - settings.lastChestOpenLikes);
                                    chestLog(`VIEWER: Post-animation check: likesInChest=${likesInChest}, threshold=${settings.threshold}`);
                                    if (likesInChest >= settings.threshold) {
                                        chestLog('VIEWER: Post-animation threshold met, fetching countdown...');
                                        // Fetch countdown timestamp from Firebase
                                        onViewerThresholdReached();
                                    } else {
                                        chestLog('VIEWER: Post-animation threshold NOT met');
                                        updateViewerNoticeBar();
                                    }
                                } else {
                                    chestLog('VIEWER: No settings available after animation');
                                    updateViewerNoticeBar();
                                }
                            });
                            return;
                        }
                    }
                }
            }
        });

        viewerAnimationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        chestLog('startViewerMonitoring: Watching for chest animation');
    }
}

let viewerAudienceObserver = null;
let viewerAnimationObserver = null;
let viewerCountdownActive = false;
let viewerCountdownInterval = null;
let viewerAnimationPlaying = false;
let viewerLastAnimationStartTime = 0;
let viewerLastAnimationEndTime = 0;

function stopViewerMonitoring() {
    if (!viewerModeActive) return;

    viewerModeActive = false;
    viewerWaitingForCountdown = false;
    viewerWaitingForAnimation = false;
    viewerAnimationPlaying = false;
    viewerDropBaseline = 0;
    viewerApiPollingEndTime = 0;

    // Clear debounce timer
    if (viewerEnabledDebounceTimer) {
        clearTimeout(viewerEnabledDebounceTimer);
        viewerEnabledDebounceTimer = null;
    }

    // Unsubscribe from realtime listener
    if (viewerChestEnabledUnsubscribe) {
        viewerChestEnabledUnsubscribe();
        viewerChestEnabledUnsubscribe = null;
        chestLog('stopViewerMonitoring: Unsubscribed from chestEnabled');
    }

    if (viewerAudienceObserver) {
        viewerAudienceObserver.disconnect();
        viewerAudienceObserver = null;
    }

    if (viewerAnimationObserver) {
        viewerAnimationObserver.disconnect();
        viewerAnimationObserver = null;
    }

    if (viewerCountdownInterval) {
        clearInterval(viewerCountdownInterval);
        viewerCountdownInterval = null;
    }
    viewerCountdownActive = false;

    chestLog('stopViewerMonitoring: Stopped');

    clearBroadcasterChestSettings();
    hideNoticeBar();
}

// ============ Chest UI Override ============
// Override YouNow's chest modal to show BetterNow's calculated like count

function overrideChestModalLikes() {
    // Find the chest modal - can be broadcaster or viewer type
    const chestModal = document.querySelector('app-chest-modal, app-sidebar-modal-chest-broadcaster-education, app-sidebar-modal-chest-audience-education');
    if (!chestModal) {
        chestLog('overrideChestModalLikes: Modal not found');
        return;
    }

    // Target the specific likes value element - try both selectors
    // education modal: .education-chest .total-likes .value
    // regular modal: .total-likes .value
    const likesValueEl = chestModal.querySelector('.education-chest .total-likes .value') ||
        chestModal.querySelector('.total-likes .value');

    if (!likesValueEl) {
        chestLog('overrideChestModalLikes: .total-likes .value not found');
        return;
    }

    // Get YouNow's original value BEFORE we override
    const younowDisplayText = likesValueEl.textContent.trim();
    const younowDisplayValue = parseInt(younowDisplayText.replace(/,/g, '')) || 0;

    let likesInChest;
    let currentLikes;
    let lastOpened;

    if (isBroadcasting()) {
        // Broadcaster: use local tracking
        // During active drop sequence, use likesBeingDropped (already calculated)
        if (isOpeningChest && likesBeingDropped > 0) {
            likesInChest = likesBeingDropped;
            currentLikes = lastChestOpenLikes; // For logging only
            lastOpened = lastChestOpenLikes - likesBeingDropped;
            chestLog(`overrideChestModalLikes (broadcaster, during drop): using likesBeingDropped=${likesBeingDropped}`);
        } else {
            currentLikes = getCurrentLikes();
            lastOpened = lastChestOpenLikes;
            likesInChest = Math.max(0, currentLikes - lastOpened);
            chestLog(`overrideChestModalLikes (broadcaster): currentLikes=${currentLikes}, lastOpened=${lastOpened}, likesInChest=${likesInChest}`);
        }
    } else {
        // Viewer: use Firebase settings or cached drop amount
        if (!broadcasterChestSettings) {
            chestLog('overrideChestModalLikes: No broadcaster settings for viewer');
            return;
        }

        // During active animation/countdown, use viewerCurrentDropLikes if available
        if (viewerCurrentDropLikes > 0) {
            likesInChest = viewerCurrentDropLikes;
            currentLikes = 0; // Not used during drop
            lastOpened = 0;
            chestLog(`overrideChestModalLikes (viewer, during drop): using viewerCurrentDropLikes=${viewerCurrentDropLikes}`);
        } else {
            currentLikes = getAudienceLikes();
            lastOpened = broadcasterChestSettings.lastChestOpenLikes || 0;
            likesInChest = Math.max(0, currentLikes - lastOpened);
            chestLog(`overrideChestModalLikes (viewer): currentLikes=${currentLikes}, lastOpened=${lastOpened}, likesInChest=${likesInChest}`);
        }
    }

    const newText = likesInChest.toLocaleString();

    // Log the comparison between YouNow's value and BetterNow's calculation
    const drift = younowDisplayValue - likesInChest;
    if (drift !== 0) {
        chestLog(`Chest modal UI: ${younowDisplayText} → ${newText}`);

        // Warn if significant drift detected (YouNow's platform bug)
        if (Math.abs(drift) > 100) {
            chestWarn(`⚠️ PLATFORM DRIFT DETECTED: YouNow shows ${younowDisplayValue.toLocaleString()} but BetterNow tracks ${likesInChest.toLocaleString()} (drift: ${drift > 0 ? '+' : ''}${drift.toLocaleString()})`);
            chestWarn(`   This is the YouNow bug where likes don't reset after chest drops.`);
            chestWarn(`   Use syncChest() in console to reset BetterNow tracking if needed.`);
        }

        likesValueEl.textContent = newText;
    }
}

// Observer to detect chest modal opening
let chestModalObserver = null;
let chestModalOpen = false;

function setupChestModalObserver() {
    if (chestModalObserver) return;

    chestModalObserver = new MutationObserver((mutations) => {
        // Check if modal exists now (handles both adding and class/style changes)
        // The chest modal can be broadcaster OR viewer type
        const modalExists = document.querySelector('app-chest-modal, app-sidebar-modal-chest-broadcaster-education, app-sidebar-modal-chest-audience-education') !== null;

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

    console.log('[BetterNow Chest] === Chest Status ===');
    console.log('[BetterNow Chest] Total likes:', currentLikes.toLocaleString());
    console.log('[BetterNow Chest] Last dropped at:', lastChestOpenLikes.toLocaleString());
    console.log('[BetterNow Chest] In chest now:', likesInChest.toLocaleString());
    console.log('[BetterNow Chest] Threshold:', threshold.toLocaleString());
    console.log('[BetterNow Chest] Until drop:', untilDrop.toLocaleString(), 'more likes');
};

// Sync chest tracking to current likes (useful after a break or manual drop)
window.syncChest = async function() {
    console.log('[BetterNow Chest] Syncing chest with YouNow API...');

    const success = await syncChestWithYouNow();

    if (success) {
        const currentLikes = getCurrentLikes();
        const likesInChest = currentLikes - lastChestOpenLikes;
        console.log('[BetterNow Chest] Chest synced with YouNow!');
        console.log('[BetterNow Chest] Current stream likes:', currentLikes.toLocaleString());
        console.log('[BetterNow Chest] Likes in chest:', likesInChest.toLocaleString());
        console.log('[BetterNow Chest] lastChestOpenLikes set to:', lastChestOpenLikes.toLocaleString());
        updateNoticeBar();
    } else {
        console.log('[BetterNow Chest] API sync failed. Falling back to manual reset...');
        const currentLikes = getCurrentLikes();
        lastChestOpenLikes = currentLikes;
        lastCheckedLikes = currentLikes;
        saveChestSettingsLocal();
        console.log('[BetterNow Chest] Chest manually reset to', currentLikes.toLocaleString(), 'likes');
        console.log('[BetterNow Chest] Chest now shows 0 likes accumulated');
    }
};

chestLog('Chest module initialized (audience-based tracking)');