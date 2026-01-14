// ============ Missions Auto-Claim ============
// Automatically claims completed daily missions via API
// Uses TRPX_DEVICE_ID and REQUEST_BY from localStorage (set by YouNow for logged-in users)

const MISSIONS_DEBUG = true;

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

// API endpoints
const MISSIONS_API_BASE = 'https://api.younow.com/php/api/userMissions';

// ============ TDI and Auth Tokens ============
// YouNow stores these in localStorage

// Get TDI from localStorage - YouNow stores it as TRPX_DEVICE_ID
function getTdi() {
    return localStorage.getItem('TRPX_DEVICE_ID');
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
        missionsWarn('claimMissionApi: No TRPX_DEVICE_ID in localStorage');
        return false;
    }

    if (!requestBy) {
        missionsWarn('claimMissionApi: No REQUEST_BY token in localStorage');
        return false;
    }

    missionsLog(`claimMissionApi: Claiming "${mission.title}" (id: ${mission.missionProgressId})`);
    missionsLog('claimMissionApi: Got TDI:', tdi.substring(0, 4) + '...', 'X-Requested-By:', requestBy.substring(0, 8) + '...');

    // Use XMLHttpRequest to match YouNow's exact approach (not fetch)
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${MISSIONS_API_BASE}/claim`, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
        xhr.setRequestHeader('X-Requested-By', requestBy);
        xhr.withCredentials = true;

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                try {
                    const result = JSON.parse(xhr.responseText);
                    missionsLog('claimMissionApi: Response:', result);

                    // Check for API-level errors
                    if (result.errorCode && result.errorCode !== 0) {
                        missionsError('claimMissionApi: API error:', result.errorMsg || result.errorCode);
                        resolve(false);
                    } else {
                        missionsClaimedCount++;
                        missionsLog(`claimMissionApi: Claimed "${mission.title}" (total this session: ${missionsClaimedCount})`);
                        resolve(true);
                    }
                } catch (e) {
                    missionsError('claimMissionApi: Parse error:', e, 'Response:', xhr.responseText);
                    resolve(false);
                }
            }
        };

        xhr.onerror = function() {
            missionsError('claimMissionApi: XHR error');
            resolve(false);
        };

        const body = `userId=${userId}&missionProgressId=${mission.missionProgressId}&tdi=${encodeURIComponent(tdi)}&lang=en`;
        missionsLog('claimMissionApi: Sending XHR');
        xhr.send(body);
    });
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

    // Check if we have required tokens
    if (!hasTdi()) {
        missionsWarn('autoClaimMissions: No TRPX_DEVICE_ID in localStorage');
        return;
    }
    if (!getRequestBy()) {
        missionsWarn('autoClaimMissions: No REQUEST_BY in localStorage');
        return;
    }

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

        // Claim all missions via API
        let claimedCount = 0;
        for (const mission of claimable) {
            const success = await claimMissionApi(mission);
            if (success) {
                claimedCount++;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        missionsLog(`autoClaimMissions: Claimed ${claimedCount}/${claimable.length} missions via API`);

    } catch (e) {
        missionsError('autoClaimMissions: Error during claim sequence:', e);
    }

    isClaimingMission = false;
}

// ============ Mission Complete Detection ============

function isMissionCompletePopupVisible() {
    // Check for the "Mission Complete" popup that appears when a mission is finished
    const popup = document.querySelector('popover-container.popover--onboarding .popover-body');
    if (popup && popup.textContent.trim() === 'Mission Complete') {
        return true;
    }
    return false;
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
                    // Check for onboarding popover (used for mission complete)
                    if (node.matches?.('popover-container.popover--onboarding') ||
                        node.querySelector?.('popover-container.popover--onboarding')) {

                        setTimeout(() => {
                            if (isMissionCompletePopupVisible()) {
                                missionsLog('Mission Complete popup detected! Triggering auto-claim...');
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

    missionsLog('Observer started - watching for Mission Complete popups');
}

function stopMissionsObserver() {
    if (missionsObserver) {
        missionsLog('stopMissionsObserver: Stopping observer');
        missionsObserver.disconnect();
        missionsObserver = null;
        missionsLog('Observer stopped');
    }
}

// ============ Toolbar Button ============

function createMissionsAutoClaimButton() {
    if (document.getElementById('betternow-missions-btn')) return;

    // Only show on live broadcasts
    const isLive = document.querySelector('.broadcaster-is-online');
    if (!isLive) return;

    // Check if user has access to autoMissions feature
    if (typeof userHasFeature === 'function' && !userHasFeature('autoMissions')) {
        return;
    }

    const toolbar = document.getElementById('betternow-toolbar');
    if (!toolbar) return;

    const leftSection = toolbar.querySelector('.betternow-toolbar__left');
    if (!leftSection) return;

    missionsLog('createMissionsAutoClaimButton: Creating button');

    const missionsBtn = document.createElement('button');
    missionsBtn.id = 'betternow-missions-btn';
    missionsBtn.textContent = 'AUTO MISSIONS';
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

    missionsBtn.style.cssText = btnStyle + `
        background: ${missionsAutoClaimEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-mediumgray, #888)'};
        color: ${missionsAutoClaimEnabled ? '#000' : 'var(--color-white, #fff)'};
    `;
    missionsBtn.title = 'Automatically claim completed daily missions';

    missionsBtn.onclick = () => {
        missionsAutoClaimEnabled = !missionsAutoClaimEnabled;
        localStorage.setItem('betternow_missionsAutoClaim', missionsAutoClaimEnabled.toString());

        missionsLog('Toggle clicked, enabled:', missionsAutoClaimEnabled);

        if (missionsAutoClaimEnabled) {
            missionsBtn.style.background = 'var(--color-primary-green, #08d687)';
            missionsBtn.style.color = '#000';
            setupMissionsObserver();
            // Check for any already-claimable missions
            setTimeout(autoClaimMissions, 500);
        } else {
            missionsBtn.style.background = 'var(--color-mediumgray, #888)';
            missionsBtn.style.color = 'var(--color-white, #fff)';
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

// No initialization needed - TDI is read directly from localStorage (TRPX_DEVICE_ID)

// ============ Debug Helpers ============

// Show current state
window.debugMissions = async function() {
    const data = await fetchMissions();
    const claimable = data ? getClaimableMissionsFromData(data) : [];
    const allMissions = data?.sections?.[0]?.missions || [];

    console.log('[BetterNow Missions] Current State:');
    console.log('  Enabled:', missionsAutoClaimEnabled);
    console.log('  Observer active:', !!missionsObserver);
    console.log('  TRPX_DEVICE_ID:', getTdi() ? getTdi().substring(0, 8) + '...' : '(none)');
    console.log('  REQUEST_BY:', getRequestBy() ? getRequestBy().substring(0, 8) + '...' : '(none)');
    console.log('  User ID:', getMissionsUserId());
    console.log('  Claimed this session:', missionsClaimedCount);
    console.log('  Total missions:', allMissions.length);
    console.log('  Claimable missions:', claimable.length);

    if (allMissions.length > 0) {
        console.log('  All missions:');
        allMissions.forEach(m => console.log(`    - [${m.state}] ${m.title} (id: ${m.missionProgressId})`));
    }

    return { enabled: missionsAutoClaimEnabled, hasTdi: hasTdi(), hasRequestBy: !!getRequestBy(), claimable, allMissions };
};

// Manually trigger claim (bypasses throttle)
window.claimMissionsNow = async function() {
    console.log('[BetterNow Missions] Manual claim triggered');
    isClaimingMission = false;
    lastMissionsCheck = 0;
    await autoClaimMissions();
};

// Test claiming a specific mission by ID
window.testClaimMission = async function(missionProgressId) {
    if (!missionProgressId) {
        console.log('[BetterNow Missions] Usage: testClaimMission(missionProgressId)');
        console.log('  Run debugMissions() first to see available mission IDs');
        return;
    }

    const data = await fetchMissions();
    const allMissions = data?.sections?.[0]?.missions || [];
    const mission = allMissions.find(m => m.missionProgressId === missionProgressId || m.missionProgressId === String(missionProgressId));

    if (!mission) {
        console.error('[BetterNow Missions] Mission not found with ID:', missionProgressId);
        return false;
    }

    console.log('[BetterNow Missions] Testing claim for:', mission.title, '(state:', mission.state + ')');

    if (mission.state !== 'CLAIM') {
        console.warn('[BetterNow Missions] Warning: Mission state is', mission.state, '- claim may fail');
    }

    const result = await claimMissionApi(mission);
    console.log('[BetterNow Missions] Claim result:', result ? 'SUCCESS' : 'FAILED');
    return result;
};

// Check if Mission Complete popup is currently visible
window.checkMissionPopup = function() {
    const visible = isMissionCompletePopupVisible();
    console.log('[BetterNow Missions] Mission Complete popup visible:', visible);

    // Also show what popovers exist
    const popovers = document.querySelectorAll('popover-container');
    if (popovers.length > 0) {
        console.log('[BetterNow Missions] Found popovers:');
        popovers.forEach(p => {
            const classes = p.className;
            const bodyText = p.querySelector('.popover-body')?.textContent?.trim().substring(0, 50) || '(no body)';
            console.log(`  - ${classes}: "${bodyText}"`);
        });
    } else {
        console.log('[BetterNow Missions] No popovers found');
    }

    return visible;
};

// Toggle debug mode
window.setMissionsDebug = function(enabled) {
    // This won't persist but useful for current session
    console.log('[BetterNow Missions] Debug logging:', enabled ? 'ON' : 'OFF');
    console.log('  Note: Edit MISSIONS_DEBUG in missions.js for persistent change');
};

missionsLog('Missions module initialized');
missionsLog('TRPX_DEVICE_ID:', getTdi() ? 'present' : 'missing');
missionsLog('REQUEST_BY:', getRequestBy() ? 'present' : 'missing');