// ============ Missions Auto-Claim ============
// Automatically claims completed daily missions
// First claim: user clicks manually, we capture TDI
// Subsequent claims: uses API directly with captured TDI

const MISSIONS_DEBUG = true; // Set to false for production

function missionsLog(...args) {
    if (MISSIONS_DEBUG) {
        console.log('[BetterNow Missions]', new Date().toISOString().substr(11, 12), ...args);
    }
}

function missionsWarn(...args) {
    console.warn('[BetterNow Missions]', new Date().toISOString().substr(11, 12), ...args);
}

function missionsError(...args) {
    console.error('[BetterNow Missions]', new Date().toISOString().substr(11, 12), ...args);
}

let missionsAutoClaimEnabled = localStorage.getItem('betternow_missionsAutoClaim') === 'true';
let missionsObserver = null;
let isClaimingMissions = false;
let missionsClaimedCount = 0;
let tdiCaptureActive = false;

// Delay between mission claims (ms)
const MISSION_CLAIM_DELAY_MS = 1000;

// API endpoints
const MISSIONS_API_BASE = 'https://api.younow.com/php/api/userMissions';

// ============ TDI Capture ============
// Injects into page context to intercept XHR/fetch requests

function setupTdiCapture() {
    if (tdiCaptureActive) return;
    tdiCaptureActive = true;

    // Inject the TDI capture script into page context
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('js/features/missions/tdi-capture.js');
    script.onload = function() {
        this.remove();
        missionsLog('TDI capture script injected into page context');
    };
    (document.head || document.documentElement).appendChild(script);

    // Listen for TDI captured via postMessage from page context
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'BETTERNOW_TDI_CAPTURED') {
            const tdi = event.data.tdi;
            if (tdi) {
                const existingTdi = localStorage.getItem('betternow_tdi');
                if (!existingTdi || existingTdi !== tdi) {
                    localStorage.setItem('betternow_tdi', tdi);
                    missionsLog('TDI captured and stored:', tdi.substring(0, 20) + '...');

                    // Auto-claim remaining missions after TDI capture
                    if (missionsAutoClaimEnabled) {
                        missionsLog('Auto-claiming remaining missions after TDI capture...');
                        setTimeout(() => {
                            claimAllRemainingMissions();
                        }, MISSION_CLAIM_DELAY_MS);
                    }
                }
            }
        }
    });

    missionsLog('TDI capture listener initialized');
}

// Get stored TDI
function getTdi() {
    return localStorage.getItem('betternow_tdi');
}

// Check if we have TDI
function hasTdi() {
    return !!getTdi();
}

// ============ User ID ============

function getMissionsUserId() {
    // Try to get from currentUserId global (set by script.js)
    if (typeof currentUserId !== 'undefined' && currentUserId) {
        return currentUserId;
    }

    // Try to decode from nft cookie (base64 encoded userId)
    const nftMatch = document.cookie.match(/nft=([^;]+)/);
    if (nftMatch) {
        try {
            const decoded = atob(decodeURIComponent(nftMatch[1]));
            if (/^\d+$/.test(decoded)) {
                return decoded;
            }
        } catch (e) {}
    }

    // Fallback to performance API
    const entries = performance.getEntriesByType('resource');
    for (const entry of entries) {
        if (entry.name && entry.name.includes('userId=')) {
            const match = entry.name.match(/userId=(\d+)/);
            if (match) return match[1];
        }
    }

    return null;
}

// ============ API Functions ============

async function fetchMissions() {
    const userId = getMissionsUserId();
    if (!userId) {
        missionsWarn('fetchMissions: Could not get userId');
        return null;
    }

    // Add cache-buster to get fresh data
    const url = `${MISSIONS_API_BASE}/missions/lang=en/userId=${userId}&_=${Date.now()}`;
    missionsLog('fetchMissions: Fetching from', url);

    try {
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store'
        });

        if (!response.ok) {
            missionsError('fetchMissions: HTTP error', response.status);
            return null;
        }

        const data = await response.json();
        missionsLog('fetchMissions: Got', data.sections?.[0]?.missions?.length || 0, 'missions');
        return data;
    } catch (e) {
        missionsError('fetchMissions: Error', e);
        return null;
    }
}

function getClaimableMissionsFromData(data) {
    if (!data || !data.sections || !data.sections[0] || !data.sections[0].missions) {
        return [];
    }

    return data.sections[0].missions.filter(m => m.state === 'CLAIM');
}

async function claimMissionApi(mission) {
    const userId = getMissionsUserId();
    const tdi = getTdi();

    if (!userId) {
        missionsError('claimMissionApi: Could not get userId');
        return false;
    }

    if (!tdi) {
        missionsWarn('claimMissionApi: No TDI available - need manual claim first');
        return false;
    }

    const url = `${MISSIONS_API_BASE}/claim`;
    const body = new URLSearchParams({
        userId: userId,
        missionProgressId: mission.missionProgressId.toString(),
        tdi: tdi,
        lang: 'en'
    });

    missionsLog(`claimMissionApi: Claiming "${mission.title}" (id: ${mission.missionProgressId})`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        if (!response.ok) {
            missionsError('claimMissionApi: HTTP error', response.status);
            return false;
        }

        const result = await response.json();

        if (result.errorCode) {
            missionsError('claimMissionApi: API error', result.errorCode, result.errorMsg);
            return false;
        }

        missionsClaimedCount++;
        missionsLog(`claimMissionApi: SUCCESS - Claimed "${mission.title}" (total this session: ${missionsClaimedCount})`);
        return true;
    } catch (e) {
        missionsError('claimMissionApi: Error', e);
        return false;
    }
}

// ============ Auto-Claim Logic ============

async function claimAllRemainingMissions() {
    if (isClaimingMissions) {
        missionsLog('claimAllRemainingMissions: Already claiming, skipping');
        return;
    }

    if (!hasTdi()) {
        missionsLog('claimAllRemainingMissions: No TDI yet - waiting for manual claim');
        return;
    }

    isClaimingMissions = true;
    missionsLog('claimAllRemainingMissions: Starting...');

    try {
        // Fetch current missions
        const data = await fetchMissions();
        if (!data) {
            missionsWarn('claimAllRemainingMissions: Could not fetch missions');
            isClaimingMissions = false;
            return;
        }

        // Get claimable missions
        const claimable = getClaimableMissionsFromData(data);
        missionsLog(`claimAllRemainingMissions: Found ${claimable.length} claimable missions`);

        if (claimable.length === 0) {
            missionsLog('claimAllRemainingMissions: No missions to claim');
            isClaimingMissions = false;
            return;
        }

        // Claim each mission with delay
        let claimedCount = 0;
        for (const mission of claimable) {
            const success = await claimMissionApi(mission);
            if (success) {
                claimedCount++;
            }

            // Wait before next claim
            if (claimable.indexOf(mission) < claimable.length - 1) {
                missionsLog(`claimAllRemainingMissions: Waiting ${MISSION_CLAIM_DELAY_MS}ms before next claim...`);
                await new Promise(resolve => setTimeout(resolve, MISSION_CLAIM_DELAY_MS));
            }
        }

        missionsLog(`claimAllRemainingMissions: Done - claimed ${claimedCount}/${claimable.length} missions`);

    } catch (e) {
        missionsError('claimAllRemainingMissions: Error:', e);
    }

    isClaimingMissions = false;
}

// ============ Mission Complete Detection ============

function isMissionCompletePopupVisible() {
    const popup = document.querySelector('popover-container.popover--onboarding .popover-body');
    return popup && popup.textContent.trim() === 'Mission Complete';
}

// Open the missions dashboard modal
async function openMissionsDashboard() {
    const button = document.querySelector('app-button-daily-missions button');
    if (!button) {
        missionsWarn('openMissionsDashboard: Missions button not found');
        return false;
    }

    missionsLog('openMissionsDashboard: Opening missions dashboard');
    button.click();

    // Wait for dashboard to appear
    for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const dashboard = document.querySelector('popover-container.popover--daily-missions-dashboard');
        if (dashboard) {
            missionsLog('openMissionsDashboard: Dashboard opened');
            return true;
        }
    }

    missionsWarn('openMissionsDashboard: Dashboard did not open');
    return false;
}

// Click the bottom-most claimable mission to capture TDI
async function clickBottomMissionToCaptuteTdi() {
    const dashboard = document.querySelector('popover-container.popover--daily-missions-dashboard');
    if (!dashboard) {
        missionsWarn('clickBottomMissionToCaptuteTdi: Dashboard not found');
        return false;
    }

    // Find all claim buttons - get the last one (bottom-most)
    const claimButtons = dashboard.querySelectorAll('.mission-wrapper.is-claim .button--green');
    const claimButtonsArray = Array.from(claimButtons).filter(btn => btn.textContent.trim() === 'Claim');

    if (claimButtonsArray.length === 0) {
        missionsLog('clickBottomMissionToCaptuteTdi: No claim buttons found');
        return false;
    }

    // Click the last (bottom-most) claim button
    const bottomButton = claimButtonsArray[claimButtonsArray.length - 1];
    missionsLog('clickBottomMissionToCaptuteTdi: Clicking bottom claim button');
    bottomButton.click();

    // Wait for the claim to process (TDI will be captured by our interceptor)
    await new Promise(resolve => setTimeout(resolve, 500));

    return true;
}

// Close the missions dashboard
async function closeMissionsDashboard() {
    document.body.click();
    await new Promise(resolve => setTimeout(resolve, 200));
}

function setupMissionsObserver() {
    if (missionsObserver) {
        missionsLog('setupMissionsObserver: Already observing');
        return;
    }

    missionsLog('setupMissionsObserver: Starting observer for Mission Complete popup');

    missionsObserver = new MutationObserver((mutations) => {
        if (!missionsAutoClaimEnabled || isClaimingMissions) return;

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches?.('popover-container.popover--onboarding') ||
                        node.querySelector?.('popover-container.popover--onboarding')) {

                        setTimeout(() => {
                            if (isMissionCompletePopupVisible()) {
                                missionsLog('Mission Complete popup detected!');

                                // If we have TDI, claim remaining missions after a short delay
                                if (hasTdi()) {
                                    setTimeout(claimAllRemainingMissions, MISSION_CLAIM_DELAY_MS);
                                } else {
                                    // No TDI yet - open modal and click bottom mission to capture it
                                    missionsLog('No TDI - will open modal to capture');
                                    setTimeout(captureTdiAndClaimAll, MISSION_CLAIM_DELAY_MS);
                                }
                            }
                        }, 100);
                    }
                }
            }
        }
    });

    missionsObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Open modal, click bottom mission to capture TDI, then claim rest via API
async function captureTdiAndClaimAll() {
    if (isClaimingMissions) return;
    isClaimingMissions = true;

    missionsLog('captureTdiAndClaimAll: Opening modal to capture TDI...');

    const opened = await openMissionsDashboard();
    if (!opened) {
        isClaimingMissions = false;
        return;
    }

    // Small delay for modal to fully render
    await new Promise(resolve => setTimeout(resolve, 300));

    // Click bottom mission to capture TDI
    const clicked = await clickBottomMissionToCaptuteTdi();

    if (clicked && hasTdi()) {
        missionsLog('captureTdiAndClaimAll: TDI captured! Closing modal and claiming rest via API');

        // Wait for claim to complete
        await new Promise(resolve => setTimeout(resolve, MISSION_CLAIM_DELAY_MS));

        // Close modal
        await closeMissionsDashboard();

        // Claim remaining via API
        isClaimingMissions = false;
        await claimAllRemainingMissions();
    } else {
        missionsLog('captureTdiAndClaimAll: Could not capture TDI');
        await closeMissionsDashboard();
        isClaimingMissions = false;
    }
}

function stopMissionsObserver() {
    if (missionsObserver) {
        missionsLog('stopMissionsObserver: Stopping observer');
        missionsObserver.disconnect();
        missionsObserver = null;
    }
}

// ============ Toolbar Button ============

function createMissionsAutoClaimButton() {
    if (document.getElementById('betternow-missions-btn')) return;

    // Only show on live broadcasts
    const isLive = document.querySelector('.broadcaster-is-online');
    if (!isLive) return;

    // Admin-only feature for now
    if (typeof ADMIN_USER_IDS !== 'undefined' && typeof currentUserId !== 'undefined') {
        if (!ADMIN_USER_IDS.includes(currentUserId) && !ADMIN_USER_IDS.includes(String(currentUserId))) {
            return;
        }
    } else {
        return;
    }

    const toolbar = document.getElementById('betternow-toolbar');
    if (!toolbar) return;

    const leftSection = toolbar.querySelector('.betternow-toolbar__left');
    if (!leftSection) return;

    missionsLog('createMissionsAutoClaimButton: Creating button');

    const missionsBtn = document.createElement('button');
    missionsBtn.id = 'betternow-missions-btn';
    missionsBtn.textContent = 'AUTO CLAIM';
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

    // Show different color based on state
    const hasStoredTdi = hasTdi();
    missionsBtn.style.cssText = btnStyle + `
        background: ${missionsAutoClaimEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-mediumgray, #888)'};
    `;
    missionsBtn.title = hasStoredTdi
        ? 'Auto-claim missions (ready - TDI captured)'
        : 'Auto-claim missions (claim one manually to activate)';

    missionsBtn.onclick = async () => {
        missionsAutoClaimEnabled = !missionsAutoClaimEnabled;
        localStorage.setItem('betternow_missionsAutoClaim', missionsAutoClaimEnabled.toString());

        missionsLog('Toggle clicked, enabled:', missionsAutoClaimEnabled, 'hasTdi:', hasTdi());

        if (missionsAutoClaimEnabled) {
            missionsBtn.style.background = 'var(--color-primary-green, #08d687)';
            setupMissionsObserver();

            if (hasTdi()) {
                // Already have TDI, claim any available missions
                claimAllRemainingMissions();
            } else {
                // No TDI - open modal and capture it
                missionsLog('No TDI on enable - checking for claimable missions...');
                await captureTdiAndClaimAll();
            }
        } else {
            missionsBtn.style.background = 'var(--color-mediumgray, #888)';
            stopMissionsObserver();
        }
    };

    // Insert before auto chest controls
    const autoChestControls = document.getElementById('auto-chest-controls');
    const chestMarker = document.getElementById('betternow-chest-marker');
    if (autoChestControls) {
        leftSection.insertBefore(missionsBtn, autoChestControls);
    } else if (chestMarker) {
        leftSection.insertBefore(missionsBtn, chestMarker);
    } else {
        leftSection.appendChild(missionsBtn);
    }

    // Start observer if already enabled
    if (missionsAutoClaimEnabled) {
        setupMissionsObserver();
    }
}

// ============ Initialization ============

// Set up TDI capture immediately
setupTdiCapture();

// ============ Debug Helpers ============

window.debugMissions = async function() {
    const data = await fetchMissions();
    const claimable = data ? getClaimableMissionsFromData(data) : [];

    console.log('[BetterNow Missions] Current State:');
    console.log('  Enabled:', missionsAutoClaimEnabled);
    console.log('  TDI:', getTdi() ? getTdi().substring(0, 20) + '...' : '(none)');
    console.log('  User ID:', getMissionsUserId());
    console.log('  Claimed this session:', missionsClaimedCount);
    console.log('  Currently claiming:', isClaimingMissions);
    console.log('  Observer active:', !!missionsObserver);
    console.log('  Claimable missions:', claimable.length);
    claimable.forEach(m => console.log(`    - ${m.title} (id: ${m.missionProgressId})`));

    return { enabled: missionsAutoClaimEnabled, tdi: getTdi(), claimable };
};

window.claimMissionsNow = async function() {
    missionsLog('Manual claim triggered via console');
    await claimAllRemainingMissions();
};

window.clearMissionsTdi = function() {
    localStorage.removeItem('betternow_tdi');
    console.log('[BetterNow Missions] TDI cleared - next claim will need manual click');
};

window.setMissionsTdi = function(tdi) {
    localStorage.setItem('betternow_tdi', tdi);
    console.log('[BetterNow Missions] TDI set manually');
};

missionsLog('Missions module initialized');
missionsLog('TDI status:', hasTdi() ? 'Ready' : 'Waiting for manual claim');