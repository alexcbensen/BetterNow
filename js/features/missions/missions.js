// ============ Missions Auto-Claim ============
// Automatically claims completed daily missions via API

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

// API endpoints
const MISSIONS_API_BASE = 'https://api.younow.com/php/api/userMissions';

// Get current user ID from cookie or performance API
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

// Get TDI (device identifier) - appears to be stable per device/session
function getTdi() {
    // For now, we'll extract it from a request or use a stored value
    // The tdi appears to be stable, so we can store it once found
    const stored = localStorage.getItem('betternow_tdi');
    if (stored) return stored;

    // If not stored, we'll need to intercept it from YouNow's requests
    // For now, return null and fall back to UI method
    return null;
}

// Store TDI when we discover it
function setTdi(tdi) {
    if (tdi && tdi.length > 0) {
        localStorage.setItem('betternow_tdi', tdi);
        missionsLog('TDI stored:', tdi);
    }
}

// Fetch missions from API
async function fetchMissions() {
    const userId = getMissionsUserId();
    if (!userId) {
        missionsWarn('fetchMissions: Could not get userId');
        return null;
    }

    const url = `${MISSIONS_API_BASE}/missions/lang=en/userId=${userId}`;
    missionsLog('fetchMissions: Fetching from', url);

    try {
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include'
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

// Get claimable missions from API response
function getClaimableMissionsFromData(data) {
    if (!data || !data.sections || !data.sections[0] || !data.sections[0].missions) {
        return [];
    }

    return data.sections[0].missions.filter(m => m.state === 'CLAIM');
}

// Claim a mission via API
async function claimMissionApi(mission) {
    const userId = getMissionsUserId();
    const tdi = getTdi();

    if (!userId) {
        missionsError('claimMissionApi: Could not get userId');
        return false;
    }

    if (!tdi) {
        missionsWarn('claimMissionApi: No TDI available, falling back to UI method');
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
        missionsLog('claimMissionApi: Response', result);

        missionsClaimedCount++;
        missionsLog(`claimMissionApi: Claimed "${mission.title}" (total this session: ${missionsClaimedCount})`);
        return true;
    } catch (e) {
        missionsError('claimMissionApi: Error', e);
        return false;
    }
}

// Check if "Mission Complete" popup is visible
function isMissionCompletePopupVisible() {
    const popup = document.querySelector('popover-container.popover--onboarding .popover-body');
    return popup && popup.textContent.trim() === 'Mission Complete';
}

// Main auto-claim function using API
async function autoClaimMissions() {
    if (!missionsAutoClaimEnabled || isClaimingMission) {
        return;
    }

    // Throttle checks to once per 5 seconds
    const now = Date.now();
    if (now - lastMissionsCheck < 5000) {
        missionsLog('autoClaimMissions: Throttled, skipping');
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

        // Check if we have TDI for API claims
        const tdi = getTdi();

        if (tdi) {
            // Claim all via API
            let claimedCount = 0;
            for (const mission of claimable) {
                const success = await claimMissionApi(mission);
                if (success) {
                    claimedCount++;
                    // Small delay between claims
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            missionsLog(`autoClaimMissions: Claimed ${claimedCount}/${claimable.length} missions via API`);
        } else {
            // Fall back to UI method
            missionsLog('autoClaimMissions: No TDI, using UI fallback');
            await autoClaimMissionsUI();
        }

    } catch (e) {
        missionsError('autoClaimMissions: Error during claim sequence:', e);
    }

    isClaimingMission = false;
}

// UI-based fallback for claiming missions
async function autoClaimMissionsUI() {
    // Open the missions dashboard
    const button = document.querySelector('app-button-daily-missions button');
    if (!button) {
        missionsWarn('autoClaimMissionsUI: Missions button not found');
        return;
    }

    missionsLog('autoClaimMissionsUI: Opening missions dashboard');
    button.click();

    // Wait for dashboard to appear
    await new Promise(resolve => setTimeout(resolve, 500));

    const dashboard = document.querySelector('popover-container.popover--daily-missions-dashboard');
    if (!dashboard) {
        missionsWarn('autoClaimMissionsUI: Dashboard did not open');
        return;
    }

    // Find and click claim buttons
    let claimedCount = 0;
    let maxIterations = 20;

    while (maxIterations > 0) {
        maxIterations--;

        const claimButtons = dashboard.querySelectorAll('.mission-wrapper.is-claim .button--green');
        const claimButton = Array.from(claimButtons).find(btn => btn.textContent.trim() === 'Claim');

        if (!claimButton) {
            missionsLog('autoClaimMissionsUI: No more claim buttons found');
            break;
        }

        missionsLog('autoClaimMissionsUI: Clicking claim button');
        claimButton.click();
        claimedCount++;
        missionsClaimedCount++;

        // Close and reopen dashboard (YouNow bug workaround)
        await new Promise(resolve => setTimeout(resolve, 300));
        document.body.click();
        await new Promise(resolve => setTimeout(resolve, 300));
        button.click();
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Close dashboard
    document.body.click();

    missionsLog(`autoClaimMissionsUI: Claimed ${claimedCount} missions`);
}

// Watch for "Mission Complete" popup
function setupMissionsObserver() {
    if (missionsObserver) {
        missionsLog('setupMissionsObserver: Already observing');
        return;
    }

    missionsLog('setupMissionsObserver: Starting observer');

    missionsObserver = new MutationObserver((mutations) => {
        if (!missionsAutoClaimEnabled || isClaimingMission) return;

        // Check if Mission Complete popup appeared
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if it's the Mission Complete popover
                    if (node.matches?.('popover-container.popover--onboarding') ||
                        node.querySelector?.('popover-container.popover--onboarding')) {

                        // Verify it says "Mission Complete"
                        setTimeout(() => {
                            if (isMissionCompletePopupVisible()) {
                                missionsLog('Mission Complete popup detected!');
                                // Small delay then auto-claim
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

// Intercept XHR to capture TDI from YouNow's own requests
function setupTdiInterceptor() {
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.send = function(data) {
        if (data && typeof data === 'string' && data.includes('tdi=')) {
            try {
                const params = new URLSearchParams(data);
                const tdi = params.get('tdi');
                if (tdi && !getTdi()) {
                    setTdi(tdi);
                }
            } catch (e) {}
        }
        return originalXHRSend.call(this, data);
    };

    missionsLog('TDI interceptor set up');
}

// Create toggle button in BetterNow toolbar
function createMissionsAutoClaimButton() {
    // Check if button already exists
    if (document.getElementById('betternow-missions-btn')) return;

    // Admin-only feature for now
    if (typeof ADMIN_USER_IDS !== 'undefined' && typeof currentUserId !== 'undefined') {
        if (!ADMIN_USER_IDS.includes(currentUserId) && !ADMIN_USER_IDS.includes(String(currentUserId))) {
            return; // Not an admin, don't show button
        }
    } else {
        return; // Can't verify admin status, don't show
    }

    // Find the BetterNow toolbar left section
    const toolbar = document.getElementById('betternow-toolbar');
    if (!toolbar) return;

    const leftSection = toolbar.querySelector('.betternow-toolbar__left');
    if (!leftSection) return;

    missionsLog('createMissionsAutoClaimButton: Creating button (admin-only)');

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
    missionsBtn.style.cssText = btnStyle + `
        background: ${missionsAutoClaimEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-mediumgray, #888)'};
    `;
    missionsBtn.title = 'Auto-claim completed daily missions';

    missionsBtn.onclick = () => {
        missionsAutoClaimEnabled = !missionsAutoClaimEnabled;
        localStorage.setItem('betternow_missionsAutoClaim', missionsAutoClaimEnabled.toString());

        missionsLog('Toggle clicked, missionsAutoClaimEnabled:', missionsAutoClaimEnabled);

        if (missionsAutoClaimEnabled) {
            missionsBtn.style.background = 'var(--color-primary-green, #08d687)';
            setupMissionsObserver();
        } else {
            missionsBtn.style.background = 'var(--color-mediumgray, #888)';
            stopMissionsObserver();
        }
    };

    // Insert before auto chest controls (if exists) or chest marker to maintain button order
    const autoChestControls = document.getElementById('auto-chest-controls');
    const chestMarker = document.getElementById('betternow-chest-marker');
    if (autoChestControls) {
        leftSection.insertBefore(missionsBtn, autoChestControls);
    } else if (chestMarker) {
        leftSection.insertBefore(missionsBtn, chestMarker);
    } else {
        leftSection.appendChild(missionsBtn);
    }

    // Start observer if enabled
    if (missionsAutoClaimEnabled) {
        setupMissionsObserver();
    }
}

// Try to create button periodically (toolbar might not exist yet)
function tryCreateMissionsButton() {
    if (!document.getElementById('betternow-missions-btn')) {
        createMissionsAutoClaimButton();
    }
}

// Check periodically
setInterval(tryCreateMissionsButton, 1000);

// Set up TDI interceptor
setupTdiInterceptor();

// Debug helper
window.debugMissions = async function() {
    const data = await fetchMissions();
    const claimable = data ? getClaimableMissionsFromData(data) : [];

    const state = {
        enabled: missionsAutoClaimEnabled,
        isClaimingMission: isClaimingMission,
        claimedThisSession: missionsClaimedCount,
        userId: getMissionsUserId(),
        tdi: getTdi(),
        missionCompleteVisible: isMissionCompletePopupVisible(),
        totalMissions: data?.sections?.[0]?.missions?.length || 0,
        claimableMissions: claimable.map(m => ({ id: m.missionProgressId, title: m.title }))
    };
    console.log('[BetterNow Missions] Current State:');
    console.table(state);
    return state;
};

// Manual trigger for testing
window.claimMissionsNow = async function() {
    missionsLog('Manual claim triggered');
    isClaimingMission = false; // Reset flag
    lastMissionsCheck = 0; // Reset throttle
    await autoClaimMissions();
};

// Set TDI manually if needed
window.setMissionsTdi = function(tdi) {
    setTdi(tdi);
    console.log('[BetterNow Missions] TDI set to:', tdi);
};

missionsLog('Missions module initialized');
missionsLog('TDI stored:', getTdi() || '(none - will capture from YouNow requests)');