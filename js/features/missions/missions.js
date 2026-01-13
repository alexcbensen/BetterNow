// ============ Missions Auto-Claim ============
// Automatically claims completed daily missions
// First claim: captures TDI from UI click
// Future claims: uses API directly with captured TDI

const MISSIONS_DEBUG = false;

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
let isClaimingMission = false;
let missionsClaimedCount = 0;
let lastMissionsCheck = 0;
let tdiCaptureActive = false;

// API endpoints
const MISSIONS_API_BASE = 'https://api.younow.com/php/api/userMissions';

// ============ TDI Capture ============
// Intercepts XHR requests to capture the TDI when user claims via UI

function setupTdiCapture() {
    if (tdiCaptureActive) return;
    tdiCaptureActive = true;

    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalXHROpen = XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._betternowUrl = url;
        this._betternowMethod = method;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(data) {
        // Check for mission claim requests
        if (data && typeof data === 'string' &&
            this._betternowUrl?.includes('userMissions/claim') &&
            data.includes('tdi=')) {
            try {
                const params = new URLSearchParams(data);
                const tdi = params.get('tdi');
                if (tdi) {
                    const existingTdi = localStorage.getItem('betternow_tdi');
                    if (!existingTdi || existingTdi !== tdi) {
                        localStorage.setItem('betternow_tdi', tdi);
                        missionsLog('TDI captured from UI claim:', tdi);
                    }
                }
            } catch (e) {
                missionsError('TDI capture error:', e);
            }
        }
        return originalXHRSend.call(this, data);
    };

    missionsLog('TDI capture initialized');
}

// Get stored TDI
function getTdi() {
    return localStorage.getItem('betternow_tdi');
}

// Check if we have TDI
function hasTdi() {
    return !!getTdi();
}

// Get REQUEST_BY token (required security header)
function getRequestBy() {
    return localStorage.getItem('REQUEST_BY');
}

// ============ User ID ============

function getMissionsUserId() {
    // Try to get from currentUserId global (set by admin.js)
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
    const requestBy = getRequestBy();

    if (!userId) {
        missionsError('claimMissionApi: Could not get userId');
        return false;
    }

    if (!tdi) {
        missionsWarn('claimMissionApi: No TDI available');
        return false;
    }

    if (!requestBy) {
        missionsWarn('claimMissionApi: No REQUEST_BY token in localStorage');
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
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-By': requestBy
            },
            body: body.toString()
        });

        if (!response.ok) {
            missionsError('claimMissionApi: HTTP error', response.status);
            return false;
        }

        const result = await response.json();

        // Check for API-level errors
        if (result.errorCode) {
            missionsError('claimMissionApi: API error', result.errorCode, result.errorMsg || '');
            return false;
        }

        missionsClaimedCount++;
        missionsLog(`claimMissionApi: Claimed "${mission.title}" (total this session: ${missionsClaimedCount})`);
        return true;
    } catch (e) {
        missionsError('claimMissionApi: Error', e);
        return false;
    }
}

// ============ UI-Based Claiming ============
// Used when no TDI is available - opens UI and clicks buttons

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

async function closeMissionsDashboard() {
    document.body.click();
    await new Promise(resolve => setTimeout(resolve, 200));
}

async function claimOneMissionViaUI() {
    const dashboard = document.querySelector('popover-container.popover--daily-missions-dashboard');
    if (!dashboard) return false;

    // Find a claim button
    const claimButtons = dashboard.querySelectorAll('.mission-wrapper.is-claim .button--green');
    const claimButton = Array.from(claimButtons).find(btn => btn.textContent.trim() === 'Claim');

    if (!claimButton) {
        missionsLog('claimOneMissionViaUI: No claim button found');
        return false;
    }

    missionsLog('claimOneMissionViaUI: Clicking claim button');
    claimButton.click();

    // Wait for the claim to process (TDI will be captured by our interceptor)
    await new Promise(resolve => setTimeout(resolve, 500));

    return true;
}

// ============ Main Auto-Claim Logic ============

async function autoClaimMissions() {
    if (!missionsAutoClaimEnabled || isClaimingMission) {
        return;
    }

    // Throttle checks to once per 5 seconds
    const now = Date.now();
    if (now - lastMissionsCheck < 5000) {
        return;
    }
    lastMissionsCheck = now;

    isClaimingMission = true;
    missionsLog('autoClaimMissions: Starting claim sequence');

    try {
        // Fetch current missions
        const data = await fetchMissions();
        if (!data) {
            missionsWarn('autoClaimMissions: Could not fetch missions');
            isClaimingMission = false;
            return;
        }

        // Get claimable missions
        const claimable = getClaimableMissionsFromData(data);
        missionsLog(`autoClaimMissions: Found ${claimable.length} claimable missions`);

        if (claimable.length === 0) {
            missionsLog('autoClaimMissions: No missions to claim');
            isClaimingMission = false;
            return;
        }

        // Check if we have TDI and REQUEST_BY for API claims
        if (hasTdi() && getRequestBy()) {
            // Use API to claim all missions
            missionsLog('autoClaimMissions: Using API method (TDI and REQUEST_BY available)');
            let claimedCount = 0;
            for (const mission of claimable) {
                const success = await claimMissionApi(mission);
                if (success) {
                    claimedCount++;
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            missionsLog(`autoClaimMissions: Claimed ${claimedCount}/${claimable.length} missions via API`);
        } else {
            // No TDI - use UI method to claim ONE mission and capture TDI
            missionsLog('autoClaimMissions: No TDI - using UI to capture it');

            const opened = await openMissionsDashboard();
            if (!opened) {
                isClaimingMission = false;
                return;
            }

            // Claim one mission via UI - this will capture the TDI
            const claimed = await claimOneMissionViaUI();

            if (claimed && hasTdi()) {
                missionsLog('autoClaimMissions: TDI captured! Claiming remaining via API');

                // Close and use API for remaining
                await closeMissionsDashboard();

                // Re-fetch to get updated list
                const newData = await fetchMissions();
                const remaining = getClaimableMissionsFromData(newData);

                for (const mission of remaining) {
                    const success = await claimMissionApi(mission);
                    if (success) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            } else {
                // Just close the dashboard
                await closeMissionsDashboard();
            }
        }

    } catch (e) {
        missionsError('autoClaimMissions: Error during claim sequence:', e);
    }

    isClaimingMission = false;
}

// ============ Mission Complete Detection ============

function isMissionCompletePopupVisible() {
    const popup = document.querySelector('popover-container.popover--onboarding .popover-body');
    return popup && popup.textContent.trim() === 'Mission Complete';
}

function setupMissionsObserver() {
    if (missionsObserver) {
        missionsLog('setupMissionsObserver: Already observing');
        return;
    }

    missionsLog('setupMissionsObserver: Starting observer');

    missionsObserver = new MutationObserver((mutations) => {
        if (!missionsAutoClaimEnabled || isClaimingMission) return;

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches?.('popover-container.popover--onboarding') ||
                        node.querySelector?.('popover-container.popover--onboarding')) {

                        setTimeout(() => {
                            if (isMissionCompletePopupVisible()) {
                                missionsLog('Mission Complete popup detected!');
                                setTimeout(autoClaimMissions, 500);
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

    // Show different color if we have TDI (fully automatic) vs not (needs first UI claim)
    const hasStoredTdi = hasTdi();
    missionsBtn.style.cssText = btnStyle + `
        background: ${missionsAutoClaimEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-mediumgray, #888)'};
    `;
    missionsBtn.title = hasStoredTdi
        ? 'Auto-claim missions (API mode)'
        : 'Auto-claim missions (will capture TDI on first claim)';

    missionsBtn.onclick = () => {
        missionsAutoClaimEnabled = !missionsAutoClaimEnabled;
        localStorage.setItem('betternow_missionsAutoClaim', missionsAutoClaimEnabled.toString());

        missionsLog('Toggle clicked, enabled:', missionsAutoClaimEnabled, 'hasTdi:', hasTdi());

        if (missionsAutoClaimEnabled) {
            missionsBtn.style.background = 'var(--color-primary-green, #08d687)';
            setupMissionsObserver();
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
    console.log('  TDI:', getTdi() || '(none)');
    console.log('  REQUEST_BY:', getRequestBy() || '(none)');
    console.log('  User ID:', getMissionsUserId());
    console.log('  Claimed this session:', missionsClaimedCount);
    console.log('  Claimable missions:', claimable.length);
    claimable.forEach(m => console.log(`    - ${m.title} (id: ${m.missionProgressId})`));

    return { enabled: missionsAutoClaimEnabled, tdi: getTdi(), requestBy: getRequestBy(), claimable };
};

window.claimMissionsNow = async function() {
    missionsLog('Manual claim triggered');
    isClaimingMission = false;
    lastMissionsCheck = 0;
    await autoClaimMissions();
};

window.clearMissionsTdi = function() {
    localStorage.removeItem('betternow_tdi');
    console.log('[BetterNow Missions] TDI cleared');
};

window.setMissionsTdi = function(tdi) {
    localStorage.setItem('betternow_tdi', tdi);
    console.log('[BetterNow Missions] TDI set to:', tdi);
};

missionsLog('Missions module initialized');
missionsLog('Stored TDI:', getTdi() || '(none - will capture on first UI claim)');
missionsLog('REQUEST_BY:', getRequestBy() || '(none - should be set by YouNow)');