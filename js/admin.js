/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

// Admin panel and admin bar functionality

let adminButtonPending = false;
let chatFilterBypassEnabled = localStorage.getItem('betternow_chatFilterBypass') === 'true';

// ============ Get Current User ID ============
// Uses performance API to find userId from requests YouNow already made
// Sets the global currentUserId variable from config.js

function getCurrentUserId() {
    if (currentUserId) return currentUserId;

    const entries = performance.getEntriesByType('resource');
    for (const entry of entries) {
        if (entry.name && entry.name.includes('userId=')) {
            const match = entry.name.match(/userId=(\d+)/);
            if (match) {
                currentUserId = match[1];
                return currentUserId;
            }
        }
    }

    return null;
}

// ============ Chat Filter Bypass functions ============

let filterBypassInjected = false;
let filterBypassWordList = null;

async function fetchFilterBypassWordList() {
    if (filterBypassWordList) return filterBypassWordList;

    try {
        const response = await fetch(`${FIRESTORE_BASE_URL}/config/filterBypass`);
        if (!response.ok) return null;

        const data = await response.json();
        if (data.fields && data.fields.wordList && data.fields.wordList.arrayValue) {
            filterBypassWordList = data.fields.wordList.arrayValue.values.map(v => v.stringValue);
            return filterBypassWordList;
        }
    } catch (e) {
        console.error('[BetterNow] Failed to fetch filter bypass word list:', e);
    }
    return null;
}

function injectFilterBypassScript() {
    // Don't inject if extension is disabled for blocked users
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) return;

    // Check if already injected by early injector or previous call
    if (filterBypassInjected || window.__betternowFilterBypassInjected) return;

    // Inject the external script into page context
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('js/features/filter-bypass/filter-bypass.js');
    script.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);

    filterBypassInjected = true;
}

async function sendWordListToPageContext() {
    // Don't send if extension is disabled
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) return;

    const words = await fetchFilterBypassWordList();

    // Check again after async operation
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) return;

    if (words && words.length > 0) {
        window.postMessage({ type: 'BETTERNOW_FILTER_WORDLIST', words: words }, '*');
    }
}

async function enableChatFilterBypass() {
    injectFilterBypassScript();
    localStorage.setItem('betternow_chatFilterBypass', 'true');

    // Fetch and send word list
    await sendWordListToPageContext();

    // Update page context variable
    window.postMessage({ type: 'BETTERNOW_FILTER_BYPASS', enabled: true }, '*');
}

function disableChatFilterBypass() {
    localStorage.setItem('betternow_chatFilterBypass', 'false');

    // Update page context variable
    window.postMessage({ type: 'BETTERNOW_FILTER_BYPASS', enabled: false }, '*');
}

// Initialize chat filter bypass if enabled (only if extension not disabled)
function initFilterBypassIfEnabled() {
    // Don't init if extension is disabled for this user
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) return;

    if (chatFilterBypassEnabled) {
        injectFilterBypassScript();
        // Send word list after a short delay to ensure script is loaded
        setTimeout(sendWordListToPageContext, 100);
    }
}

// Wait for settings to load before initializing filter bypass
function waitForSettingsThenInitFilterBypass() {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max

    const checkInterval = setInterval(() => {
        attempts++;

        // If extension is disabled, stop
        if (typeof extensionDisabled !== 'undefined' && extensionDisabled) {
            clearInterval(checkInterval);
            return;
        }

        // If settings loaded, init filter bypass
        if (typeof settingsLoaded !== 'undefined' && settingsLoaded) {
            clearInterval(checkInterval);
            initFilterBypassIfEnabled();
            return;
        }

        // Timeout
        if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            // Only init if not disabled
            if (typeof extensionDisabled === 'undefined' || !extensionDisabled) {
                initFilterBypassIfEnabled();
            }
        }
    }, 100);
}

// Start waiting for settings
waitForSettingsThenInitFilterBypass();

// ============ Feature Access Check ============

function userHasFeature(feature) {
    const userId = getCurrentUserId();
    if (!userId) return false;

    // Admins (from ADMIN_ONLY_USER_IDS) have all features
    if (ADMIN_USER_IDS.includes(userId) || ADMIN_USER_IDS.includes(String(userId))) return true;

    // Check granted features
    const features = grantedFeatures[userId] || [];
    return features.includes(feature);
}

// ============ Filter Bypass Button (BetterNow Toolbar) ============

function createFilterBypassButton() {
    // Don't create if extension is disabled
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) return;

    // Check if button already exists
    if (document.getElementById('betternow-filter-bypass-btn')) return;

    // Check if user has access to this feature
    if (!userHasFeature('filterBypass')) return;

    // Find the BetterNow toolbar left section
    const toolbar = document.getElementById('betternow-toolbar');
    if (!toolbar) return;

    const leftSection = toolbar.querySelector('#betternow-toolbar > div:first-child');
    if (!leftSection) return;

    // Create the filter bypass toggle button
    const filterBypassBtn = document.createElement('button');
    filterBypassBtn.id = 'betternow-filter-bypass-btn';
    filterBypassBtn.textContent = 'FILTER BYPASS';
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
    filterBypassBtn.style.cssText = btnStyle + `
        background: ${chatFilterBypassEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-mediumgray, #888)'};
        color: ${chatFilterBypassEnabled ? '#000' : 'var(--color-white, #fff)'};
    `;
    filterBypassBtn.title = 'Bypass YouNow chat word filter';
    filterBypassBtn.onclick = () => {
        chatFilterBypassEnabled = !chatFilterBypassEnabled;
        if (chatFilterBypassEnabled) {
            filterBypassBtn.style.background = 'var(--color-primary-green, #08d687)';
            filterBypassBtn.style.color = '#000';
            enableChatFilterBypass();
        } else {
            filterBypassBtn.style.background = 'var(--color-mediumgray, #888)';
            filterBypassBtn.style.color = 'var(--color-white, #fff)';
            disableChatFilterBypass();
        }
        localStorage.setItem('betternow_chatFilterBypass', chatFilterBypassEnabled);
    };

    // Insert before auto chest controls (if exists) or chest marker to maintain button order
    const autoChestControls = document.getElementById('auto-chest-controls');
    const chestMarker = document.getElementById('betternow-chest-marker');
    if (autoChestControls) {
        leftSection.insertBefore(filterBypassBtn, autoChestControls);
    } else if (chestMarker) {
        leftSection.insertBefore(filterBypassBtn, chestMarker);
    } else {
        leftSection.appendChild(filterBypassBtn);
    }
}

// Try to create filter bypass button periodically (needs Firebase settings loaded)
function tryCreateFilterBypassButton() {
    // Don't create if extension is disabled
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) return;

    if (!document.getElementById('betternow-filter-bypass-btn')) {
        createFilterBypassButton();
    }
}

// Check periodically since Firebase settings load async
setInterval(tryCreateFilterBypassButton, 1000);

// Helper to ensure hex colors have # prefix
function normalizeHex(value) {
    if (!value) return '';
    value = value.trim();
    if (value && !value.startsWith('#')) {
        value = '#' + value;
    }
    return value;
}

function verifyAdminUser() {
    const userId = getCurrentUserId();
    if (!userId) return false;

    // Check admin list (ADMIN_ONLY_USER_IDS)
    return ADMIN_USER_IDS.includes(userId) || ADMIN_USER_IDS.includes(String(userId));
}

async function createAdminPanelEntry() {
    // Don't create if extension is disabled
    if (typeof extensionDisabled !== 'undefined' && extensionDisabled) return;

    if (document.getElementById('admin-panel-btn') || adminButtonPending) return;

    const currenciesWrapper = document.querySelector('app-profile-dropdown .currencies-infos-wrapper > div');
    if (!currenciesWrapper) return;

    adminButtonPending = true;

    const isAdmin = verifyAdminUser();
    if (!isAdmin) {
        adminButtonPending = false;
        return;
    }

    if (document.getElementById('admin-panel-btn')) {
        adminButtonPending = false;
        return;
    }

    // Validate token when popover opens (don't wait for it to block UI)
    let isSignedIn = !!firebaseIdToken;
    if (isSignedIn && typeof validateFirebaseToken === 'function') {
        // Check in background and update icon when done
        validateFirebaseToken().then(isValid => {
            if (!isValid) {
                const icon = document.getElementById('admin-lock-icon');
                if (icon) {
                    icon.className = 'bi bi-lock-fill';
                }
            }
        });
    }

    const adminBtn = document.createElement('button');
    adminBtn.id = 'admin-panel-btn';
    adminBtn.className = 'button';
    adminBtn.style.cssText = `
        background: #444;
        border: none;
        border-radius: 100rem;
        padding: 0.65rem 1.25rem;
        color: white;
        cursor: pointer;
        margin-top: 10px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
        font-family: proxima-nova, sans-serif;
        width: auto;
    `;
    adminBtn.innerHTML = `<i class="bi ${isSignedIn ? 'bi-unlock-fill' : 'bi-lock-fill'}" id="admin-lock-icon"></i><span>Admin Panel</span>`;
    adminBtn.title = 'Admin Panel';

    adminBtn.addEventListener('click', handleAdminClick);

    const barsBtn = currenciesWrapper.querySelector('.button--purple');
    if (barsBtn) {
        barsBtn.parentNode.insertBefore(adminBtn, barsBtn.nextSibling);
    }

    adminButtonPending = false;
}

async function handleAdminClick() {
    const popover = document.querySelector('ngb-popover-window');
    if (popover) popover.remove();

    document.body.click();

    // Check if already signed in
    if (firebaseIdToken) {
        openAdminPanel();
    } else {
        try {
            firebaseIdToken = await showAuthPrompt();
            openAdminPanel();
        } catch (e) {
            // User cancelled sign-in
        }
    }
}

function updateAdminIcon() {
    const icon = document.getElementById('admin-lock-icon');
    if (icon) {
        icon.className = firebaseIdToken ? 'bi bi-unlock-fill' : 'bi bi-lock-fill';
    }
}

function openAdminPanel() {
    const existing = document.getElementById('admin-panel-overlay');
    if (existing) existing.remove();

    // Disable page scroll
    document.body.style.overflow = 'hidden';

    const overlay = createOverlay('admin-panel-overlay', templates.adminPanel);
    document.body.appendChild(overlay);

    // Populate lists
    renderFriendUsernames();
    renderHiddenBroadcasters();

    // Setup Online Users section (fetches count immediately)
    setupOnlineUsersSection();

    // Friend Usernames dropdown toggle
    const friendToggle = document.getElementById('friend-usernames-toggle');
    const friendContent = document.getElementById('friend-usernames-content');
    const friendArrow = document.getElementById('friend-usernames-arrow');

    if (friendToggle && friendContent && friendArrow) {
        friendToggle.addEventListener('click', () => {
            const isHidden = friendContent.style.display === 'none';
            friendContent.style.display = isHidden ? 'block' : 'none';
            friendArrow.textContent = isHidden ? '▼' : '▶';
        });
    }

    // Update friend count badge
    const friendCountEl = document.getElementById('friend-usernames-count');
    if (friendCountEl) {
        friendCountEl.textContent = friendUserIds.length;
    }

    // Hidden broadcasters dropdown toggle
    const hiddenToggle = document.getElementById('hidden-broadcasters-toggle');
    const hiddenContent = document.getElementById('hidden-broadcasters-content');
    const hiddenArrow = document.getElementById('hidden-broadcasters-arrow');

    hiddenToggle.addEventListener('click', () => {
        const isHidden = hiddenContent.style.display === 'none';
        hiddenContent.style.display = isHidden ? 'block' : 'none';
        hiddenArrow.textContent = isHidden ? '▼' : '▶';
    });

    // Feature Toggles (Kill Switches) dropdown toggle
    const featureTogglesToggle = document.getElementById('feature-toggles-toggle');
    const featureTogglesContent = document.getElementById('feature-toggles-content');
    const featureTogglesArrow = document.getElementById('feature-toggles-arrow');

    if (featureTogglesToggle && featureTogglesContent && featureTogglesArrow) {
        featureTogglesToggle.addEventListener('click', () => {
            const isHidden = featureTogglesContent.style.display === 'none';
            featureTogglesContent.style.display = isHidden ? 'block' : 'none';
            featureTogglesArrow.textContent = isHidden ? '▼' : '▶';
        });

        // Helper to update toggle visual state
        const updateToggleVisual = (checkbox, slider, dot) => {
            if (checkbox.checked) {
                slider.style.backgroundColor = '#22c55e'; // Green = enabled
                dot.style.transform = 'translateX(22px)';
            } else {
                slider.style.backgroundColor = '#ef4444'; // Red = disabled
                dot.style.transform = 'translateX(0)';
            }
        };

        // Auto Chest kill switch
        const autoChestCheckbox = document.getElementById('killswitch-auto-chest');
        const autoChestSlider = document.getElementById('killswitch-auto-chest-slider');
        const autoChestDot = document.getElementById('killswitch-auto-chest-dot');

        if (autoChestCheckbox && autoChestSlider && autoChestDot) {
            // Set initial state
            autoChestCheckbox.checked = globalAutoChestEnabled;
            updateToggleVisual(autoChestCheckbox, autoChestSlider, autoChestDot);

            // Handle toggle changes
            autoChestCheckbox.addEventListener('change', async () => {
                globalAutoChestEnabled = autoChestCheckbox.checked;
                updateToggleVisual(autoChestCheckbox, autoChestSlider, autoChestDot);
                await saveSettingsToFirebase();
            });
        }

        // Auto Missions kill switch
        const autoMissionsCheckbox = document.getElementById('killswitch-auto-missions');
        const autoMissionsSlider = document.getElementById('killswitch-auto-missions-slider');
        const autoMissionsDot = document.getElementById('killswitch-auto-missions-dot');

        if (autoMissionsCheckbox && autoMissionsSlider && autoMissionsDot) {
            // Set initial state
            autoMissionsCheckbox.checked = globalAutoMissionsEnabled;
            updateToggleVisual(autoMissionsCheckbox, autoMissionsSlider, autoMissionsDot);

            // Handle toggle changes
            autoMissionsCheckbox.addEventListener('change', async () => {
                globalAutoMissionsEnabled = autoMissionsCheckbox.checked;
                updateToggleVisual(autoMissionsCheckbox, autoMissionsSlider, autoMissionsDot);
                await saveSettingsToFirebase();
            });
        }
    }

    // My Settings toggle
    const mySettingsToggle = document.getElementById('my-settings-toggle');
    const mySettingsContent = document.getElementById('my-settings-content');
    const mySettingsArrow = document.getElementById('my-settings-arrow');

    if (mySettingsToggle && mySettingsContent && mySettingsArrow) {
        mySettingsToggle.addEventListener('click', () => {
            const isHidden = mySettingsContent.style.display === 'none';
            mySettingsContent.style.display = isHidden ? 'block' : 'none';
            mySettingsArrow.textContent = isHidden ? '▼' : '▶';
        });

        // Populate my settings fields
        document.getElementById('my-border-enabled').checked = mySettings.borderEnabled || false;
        document.getElementById('my-border-color1').value = mySettings.borderColor1 || '';
        document.getElementById('my-border-color2').value = mySettings.borderColor2 || '';
        document.getElementById('my-text-enabled').checked = !!mySettings.textColor;
        document.getElementById('my-text-color').value = mySettings.textColor || '';
        document.getElementById('my-level-enabled').checked = mySettings.levelEnabled || false;
        document.getElementById('my-level-color1').value = mySettings.levelColor1 || '';
        document.getElementById('my-level-color2').value = mySettings.levelColor2 || '';
        document.getElementById('my-frame-enabled').checked = mySettings.frameEnabled || false;
        document.getElementById('my-frame-url').value = mySettings.frameUrl || '';

        // Update color previews
        const updateMyPreview = (inputId, previewId) => {
            const input = document.getElementById(inputId);
            const preview = document.getElementById(previewId);
            if (input && preview) {
                const value = normalizeHex(input.value);
                if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                    preview.style.background = value;
                }
                input.addEventListener('input', () => {
                    const val = normalizeHex(input.value);
                    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                        preview.style.background = val;
                    }
                });
            }
        };

        updateMyPreview('my-border-color1', 'my-border-preview1');
        updateMyPreview('my-border-color2', 'my-border-preview2');
        updateMyPreview('my-text-color', 'my-text-preview');
        updateMyPreview('my-level-color1', 'my-level-preview1');
        updateMyPreview('my-level-color2', 'my-level-preview2');

        // Frame preview handling
        const frameUrlInput = document.getElementById('my-frame-url');
        const framePreview = document.getElementById('my-frame-preview');
        const framePreviewImg = document.getElementById('my-frame-preview-img');

        const showFramePreview = (url) => {
            if (url) {
                framePreviewImg.src = url;
                framePreview.style.display = 'flex';
                framePreview.dataset.frameUrl = url;
                frameUrlInput.style.display = 'none';
            } else {
                framePreview.style.display = 'none';
                frameUrlInput.style.display = 'block';
            }
        };

        // Initialize frame preview if we have a URL
        if (mySettings.frameUrl) {
            showFramePreview(mySettings.frameUrl);
        }

        // Listen for paste/input on frame URL
        frameUrlInput.addEventListener('input', () => {
            const url = frameUrlInput.value.trim();
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                // Store the URL in data attribute and show preview
                framePreview.dataset.frameUrl = url;
                showFramePreview(url);
                frameUrlInput.value = '';
            }
        });

        // Click on preview to change
        framePreview.addEventListener('click', () => {
            framePreview.style.display = 'none';
            frameUrlInput.style.display = 'block';
            frameUrlInput.focus();
        });

        // Save my settings button
        document.getElementById('save-my-settings').addEventListener('click', async () => {
            const btn = document.getElementById('save-my-settings');

            const borderEnabled = document.getElementById('my-border-enabled').checked;
            const borderColor1 = normalizeHex(document.getElementById('my-border-color1').value.trim());
            const borderColor2 = normalizeHex(document.getElementById('my-border-color2').value.trim());
            const textEnabled = document.getElementById('my-text-enabled').checked;
            const textColor = normalizeHex(document.getElementById('my-text-color').value.trim());
            const levelEnabled = document.getElementById('my-level-enabled').checked;
            const levelColor1 = normalizeHex(document.getElementById('my-level-color1').value.trim());
            const levelColor2 = normalizeHex(document.getElementById('my-level-color2').value.trim());
            const frameEnabled = document.getElementById('my-frame-enabled').checked;

            // Get frame URL from preview data attribute, or input, or existing settings
            const framePreview = document.getElementById('my-frame-preview');
            const frameUrlInput = document.getElementById('my-frame-url');
            const frameUrl = framePreview.dataset.frameUrl || frameUrlInput.value.trim() || mySettings.frameUrl || '';

            mySettings = {
                borderEnabled: borderEnabled,
                borderColor1: borderEnabled ? borderColor1 : '',
                borderColor2: borderEnabled ? borderColor2 : '',
                textColor: textEnabled ? textColor : '',
                levelEnabled: levelEnabled,
                levelColor1: levelEnabled ? levelColor1 : '',
                levelColor2: levelEnabled ? levelColor2 : '',
                frameEnabled: frameEnabled,
                frameUrl: frameEnabled ? frameUrl : ''
            };

            await saveSettingsToFirebase();
            applyChatStyles();

            // Visual feedback
            btn.textContent = 'Saved!';
            setTimeout(() => { btn.textContent = 'Save My Style'; }, 1000);
        });
    }

    // BetterNow User Style toggle
    const betternowStyleToggle = document.getElementById('betternow-style-toggle');
    const betternowStyleContent = document.getElementById('betternow-style-content');
    const betternowStyleArrow = document.getElementById('betternow-style-arrow');

    if (betternowStyleToggle && betternowStyleContent && betternowStyleArrow) {
        betternowStyleToggle.addEventListener('click', () => {
            const isHidden = betternowStyleContent.style.display === 'none';
            betternowStyleContent.style.display = isHidden ? 'block' : 'none';
            betternowStyleArrow.textContent = isHidden ? '▼' : '▶';
        });

        // Populate BetterNow style fields
        const badgeUrlInput = document.getElementById('betternow-badge-url');
        const textColorInput = document.getElementById('betternow-text-color');
        const glowColorInput = document.getElementById('betternow-glow-color');
        const glowIntensityInput = document.getElementById('betternow-glow-intensity');
        const glowOpacityInput = document.getElementById('betternow-glow-opacity');
        const onlineColorInput = document.getElementById('betternow-online-color');
        const intensityValueSpan = document.getElementById('betternow-intensity-value');
        const opacityValueSpan = document.getElementById('betternow-opacity-value');
        const badgePreviewImg = document.getElementById('betternow-badge-preview-img');
        const previewBadgeIcon = document.getElementById('betternow-preview-badge-icon');
        const textPreview = document.getElementById('betternow-text-preview');
        const glowPreview = document.getElementById('betternow-glow-preview');
        const onlinePreview = document.getElementById('betternow-online-preview');
        const livePreview = document.getElementById('betternow-live-preview');

        // Set initial values - ensure sliders are set correctly
        badgeUrlInput.value = betternowUserStyle.badgeUrl || '';
        textColorInput.value = betternowUserStyle.textColor || '#e0c2f3';
        glowColorInput.value = betternowUserStyle.glowColor || '#820ad0';
        onlineColorInput.value = betternowUserStyle.onlineColor || '#820ad0';

        // Set slider values with proper defaults
        const savedIntensity = (typeof betternowUserStyle.glowIntensity === 'number') ? betternowUserStyle.glowIntensity : 6;
        const savedOpacity = (typeof betternowUserStyle.glowOpacity === 'number') ? betternowUserStyle.glowOpacity : 100;

        glowIntensityInput.value = savedIntensity;
        glowOpacityInput.value = savedOpacity;
        intensityValueSpan.textContent = savedIntensity + 'px';
        opacityValueSpan.textContent = savedOpacity + '%';

        // Helper to convert hex to rgba
        const hexToRgba = (hex, alpha) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        // Update previews with initial values
        const updateLivePreview = () => {
            const textColor = normalizeHex(textColorInput.value) || '#e0c2f3';
            const glowColor = normalizeHex(glowColorInput.value) || '#820ad0';
            const intensity = parseInt(glowIntensityInput.value);
            const opacity = parseInt(glowOpacityInput.value) / 100;
            const halfIntensity = Math.round(intensity / 2);

            livePreview.style.color = textColor;

            if (intensity === 0 || opacity === 0) {
                livePreview.style.textShadow = 'none';
            } else {
                const glowColorWithOpacity = hexToRgba(glowColor, opacity);
                livePreview.style.textShadow = `0 0 ${halfIntensity}px ${glowColorWithOpacity}, 0 0 ${intensity}px ${glowColorWithOpacity}`;
            }
        };

        // Update badge in both preview locations
        const updateBadgePreview = (url) => {
            badgePreviewImg.src = url || '';
            if (previewBadgeIcon) previewBadgeIcon.src = url || '';
        };

        // Badge preview - set initial
        updateBadgePreview(betternowUserStyle.badgeUrl || '');

        // Color previews
        const initTextColor = normalizeHex(textColorInput.value);
        const initGlowColor = normalizeHex(glowColorInput.value);
        const initOnlineColor = normalizeHex(onlineColorInput.value);
        if (/^#[0-9A-Fa-f]{6}$/.test(initTextColor)) {
            textPreview.style.background = initTextColor;
        }
        if (/^#[0-9A-Fa-f]{6}$/.test(initGlowColor)) {
            glowPreview.style.background = initGlowColor;
        }
        if (/^#[0-9A-Fa-f]{6}$/.test(initOnlineColor)) {
            onlinePreview.style.background = initOnlineColor;
        }
        updateLivePreview();

        // Badge URL input handler
        badgeUrlInput.addEventListener('input', () => {
            updateBadgePreview(badgeUrlInput.value.trim());
        });

        // Text color input handler
        textColorInput.addEventListener('input', () => {
            const val = normalizeHex(textColorInput.value);
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                textPreview.style.background = val;
            }
            updateLivePreview();
        });

        // Glow color input handler
        glowColorInput.addEventListener('input', () => {
            const val = normalizeHex(glowColorInput.value);
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                glowPreview.style.background = val;
            }
            updateLivePreview();
        });

        // Glow intensity slider handler
        glowIntensityInput.addEventListener('input', () => {
            const intensity = parseInt(glowIntensityInput.value);
            intensityValueSpan.textContent = intensity + 'px';
            updateLivePreview();
        });

        // Glow opacity slider handler
        glowOpacityInput.addEventListener('input', () => {
            const opacity = parseInt(glowOpacityInput.value);
            opacityValueSpan.textContent = opacity + '%';
            updateLivePreview();
        });

        // Online color input handler
        onlineColorInput.addEventListener('input', () => {
            const val = normalizeHex(onlineColorInput.value);
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                onlinePreview.style.background = val;
            }
        });

        // Save button handler
        document.getElementById('save-betternow-style').addEventListener('click', async () => {
            const btn = document.getElementById('save-betternow-style');

            betternowUserStyle = {
                badgeUrl: badgeUrlInput.value.trim(),
                textColor: normalizeHex(textColorInput.value.trim()) || '#e0c2f3',
                glowColor: normalizeHex(glowColorInput.value.trim()) || '#820ad0',
                glowIntensity: parseInt(glowIntensityInput.value),
                glowOpacity: parseInt(glowOpacityInput.value),
                onlineColor: normalizeHex(onlineColorInput.value.trim()) || '#820ad0'
            };

            await saveSettingsToFirebase();

            // Update online indicator CSS
            updateBetterNowOnlineIndicatorStyle();

            // Visual feedback
            btn.textContent = 'Saved!';
            setTimeout(() => { btn.textContent = 'Save Style'; }, 1000);
        });
    }

    // Close button
    const closeBtn = document.getElementById('admin-panel-close');
    closeBtn.addEventListener('click', () => {
        cleanupOnlineUsersSection();
        document.body.style.overflow = '';
        overlay.remove();
    });

    // Sign out button
    const lockBtn = document.getElementById('admin-panel-lock');
    lockBtn.addEventListener('click', () => {
        firebaseIdToken = null;
        sessionStorage.removeItem('firebaseIdToken');
        updateAdminIcon();
        cleanupOnlineUsersSection();
        document.body.style.overflow = '';
        overlay.remove();
    });

    // Add friend username
    const addFriendBtn = document.getElementById('add-friend-btn');
    const friendInput = document.getElementById('friend-username-input');

    addFriendBtn.addEventListener('click', async () => {
        const username = friendInput.value.trim();
        const statusEl = document.getElementById('admin-save-status');

        if (!username) return;

        // Fetch user info from YouNow API
        statusEl.style.display = 'block';
        statusEl.style.color = '#888';
        statusEl.textContent = 'Looking up user...';

        try {
            const response = await fetch(`https://cdn.younow.com/php/api/channel/getInfo/user=${username}`);
            const data = await response.json();

            // Only fail if there's no userId at all
            if (!data.userId) {
                statusEl.style.color = '#ef4444';
                statusEl.textContent = `User "${username}" not found`;
                setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
                return;
            }

            const odiskd = String(data.userId);

            // Check for duplicate by userId
            if (friendUserIds.includes(odiskd)) {
                statusEl.style.color = '#ef4444';
                statusEl.textContent = `"${data.profile || username}" is already in friends list`;
                setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
                return;
            }

            // Store user data
            const correctUsername = data.profile || username;
            const profileImage = `https://ynassets.younow.com/user/live/${data.userId}/${data.userId}.jpg`;

            friendUserIds.push(odiskd);
            friendUsers[odiskd] = {
                username: correctUsername,
                avatar: profileImage
            };

            renderFriendUsernames();
            friendInput.value = '';
            await saveSettingsToFirebase();

            statusEl.style.display = 'none';
        } catch (error) {
            statusEl.style.color = '#ef4444';
            statusEl.textContent = 'Error looking up user';
            setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
        }
    });
    friendInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addFriendBtn.click();
    });

    // Add hidden broadcaster
    const addHiddenBtn = document.getElementById('add-hidden-btn');
    const hiddenInput = document.getElementById('hidden-broadcaster-input');

    addHiddenBtn.addEventListener('click', async () => {
        const username = hiddenInput.value.trim();
        const statusEl = document.getElementById('admin-save-status');

        if (!username) return;

        // Fetch user info from YouNow API
        statusEl.style.display = 'block';
        statusEl.style.color = '#888';
        statusEl.textContent = 'Looking up user...';

        try {
            const response = await fetch(`https://cdn.younow.com/php/api/channel/getInfo/user=${username}`);
            const data = await response.json();

            // Only fail if there's no userId at all
            if (!data.userId) {
                statusEl.style.color = '#ef4444';
                statusEl.textContent = `User "${username}" not found`;
                setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
                return;
            }

            const odiskd = String(data.userId);

            // Check for duplicate by userId
            if (hiddenUserIds.includes(odiskd)) {
                statusEl.style.color = '#ef4444';
                statusEl.textContent = `"${data.profile || username}" is already in hidden list`;
                setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
                return;
            }

            // Store user data
            const correctUsername = data.profile || username;
            const profileImage = `https://ynassets.younow.com/user/live/${data.userId}/${data.userId}.jpg`;

            hiddenUserIds.push(odiskd);
            hiddenUsers[odiskd] = {
                username: correctUsername,
                avatar: profileImage
            };

            renderHiddenBroadcasters();
            hiddenInput.value = '';
            await saveSettingsToFirebase();

            statusEl.style.display = 'none';
        } catch (error) {
            statusEl.style.color = '#ef4444';
            statusEl.textContent = 'Error looking up user';
            setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
        }
    });
    hiddenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addHiddenBtn.click();
    });

    // Click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            cleanupOnlineUsersSection();
            document.body.style.overflow = '';
            overlay.remove();
        }
    });
}

function renderFriendUsernames() {
    const container = document.getElementById('friend-usernames-list');
    if (!container) return;

    container.innerHTML = friendUserIds.map((odiskd, index) => {
        const userData = friendUsers[odiskd] || {};
        const username = userData.username || odiskd;
        const avatar = userData.avatar || '';
        const settings = friendSettings[odiskd] || {};
        const features = grantedFeatures[odiskd] || [];
        const hasFilterBypass = features.includes('filterBypass');
        const hasAutoChest = features.includes('autoChest');
        const hasAutoMissions = features.includes('autoMissions');
        const hasHideAds = features.includes('hideAds');
        const isAdmin = ADMIN_ONLY_USER_IDS.includes(odiskd) || ADMIN_ONLY_USER_IDS.includes(String(odiskd));

        // Check kill switch states for indicators
        const chestKilled = typeof globalAutoChestEnabled !== 'undefined' && !globalAutoChestEnabled;
        const missionsKilled = typeof globalAutoMissionsEnabled !== 'undefined' && !globalAutoMissionsEnabled;

        return `
        <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #2a2a2a;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 6px;
        ">
            <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${avatar}" alt="" style="
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: #444;
                    display: ${avatar ? 'block' : 'none'};
                " onerror="this.style.display='none'" />
                <span style="color: white;">${username}</span>
            </div>
            <div style="display: flex; gap: 6px;">
                <button data-refresh-friend="${odiskd}" title="Refresh user" style="
                    background: #666;
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                    color: white;
                    font-size: 12px;
                    cursor: pointer;
                ">🔄</button>
                <button data-features-friend="${odiskd}" title="Feature access" style="
                    background: #8b5cf6;
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                    color: white;
                    font-size: 12px;
                    cursor: pointer;
                ">⚡</button>
                <button data-settings-friend="${odiskd}" title="Style settings" style="
                    background: #3b82f6;
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                    color: white;
                    font-size: 12px;
                    cursor: pointer;
                ">🎨</button>
                <button data-remove-friend="${index}" style="
                    background: #ef4444;
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                    color: white;
                    font-size: 12px;
                    cursor: pointer;
                ">Remove</button>
            </div>
        </div>
        <!-- Features panel for ${odiskd} -->
        <div id="features-panel-${odiskd}" style="
            display: none;
            background: #333;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 8px;
            margin-top: -4px;
        ">
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <p style="color: #888; font-size: 11px; margin: 0;">Grant features to ${username}:</p>
                
                <!-- Admin toggle -->
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label for="feature-admin-${odiskd}" style="color: #f59e0b; font-size: 13px; cursor: pointer; font-weight: 600;">👑 Admin (all features)</label>
                    <label style="position: relative; display: inline-block; width: 40px; height: 22px; cursor: pointer;">
                        <input type="checkbox" id="feature-admin-${odiskd}" ${isAdmin ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                        <span class="feature-slider" data-for="feature-admin-${odiskd}" style="
                            position: absolute;
                            cursor: pointer;
                            top: 0; left: 0; right: 0; bottom: 0;
                            background-color: ${isAdmin ? '#22c55e' : '#555'};
                            transition: .3s;
                            border-radius: 22px;
                        "></span>
                        <span class="feature-dot" data-for="feature-admin-${odiskd}" style="
                            position: absolute;
                            height: 16px; width: 16px;
                            left: ${isAdmin ? '21px' : '3px'}; bottom: 3px;
                            background-color: white;
                            transition: .3s;
                            border-radius: 50%;
                        "></span>
                    </label>
                </div>
                
                <hr style="border: none; border-top: 1px solid #444; margin: 0;" />
                
                <!-- Filter Bypass -->
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label for="feature-filterBypass-${odiskd}" style="color: #ccc; font-size: 13px; cursor: pointer;">Filter Bypass</label>
                    <label style="position: relative; display: inline-block; width: 40px; height: 22px; cursor: ${isAdmin ? 'not-allowed' : 'pointer'}; opacity: ${isAdmin ? '0.5' : '1'};">
                        <input type="checkbox" id="feature-filterBypass-${odiskd}" ${hasFilterBypass || isAdmin ? 'checked' : ''} ${isAdmin ? 'disabled' : ''} style="opacity: 0; width: 0; height: 0;">
                        <span class="feature-slider" data-for="feature-filterBypass-${odiskd}" style="
                            position: absolute;
                            cursor: ${isAdmin ? 'not-allowed' : 'pointer'};
                            top: 0; left: 0; right: 0; bottom: 0;
                            background-color: ${hasFilterBypass || isAdmin ? '#22c55e' : '#555'};
                            transition: .3s;
                            border-radius: 22px;
                        "></span>
                        <span class="feature-dot" data-for="feature-filterBypass-${odiskd}" style="
                            position: absolute;
                            height: 16px; width: 16px;
                            left: ${hasFilterBypass || isAdmin ? '21px' : '3px'}; bottom: 3px;
                            background-color: white;
                            transition: .3s;
                            border-radius: 50%;
                        "></span>
                    </label>
                </div>
                
                <!-- Auto Chest -->
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <label for="feature-autoChest-${odiskd}" style="color: #ccc; font-size: 13px; cursor: pointer;">Auto Chest</label>
                        ${chestKilled ? '<span style="background: #ef4444; color: white; font-size: 9px; padding: 2px 5px; border-radius: 3px; font-weight: 600;">KILLED</span>' : ''}
                    </div>
                    <label style="position: relative; display: inline-block; width: 40px; height: 22px; cursor: ${isAdmin ? 'not-allowed' : 'pointer'}; opacity: ${isAdmin ? '0.5' : '1'};">
                        <input type="checkbox" id="feature-autoChest-${odiskd}" ${hasAutoChest || isAdmin ? 'checked' : ''} ${isAdmin ? 'disabled' : ''} style="opacity: 0; width: 0; height: 0;">
                        <span class="feature-slider" data-for="feature-autoChest-${odiskd}" style="
                            position: absolute;
                            cursor: ${isAdmin ? 'not-allowed' : 'pointer'};
                            top: 0; left: 0; right: 0; bottom: 0;
                            background-color: ${hasAutoChest || isAdmin ? '#22c55e' : '#555'};
                            transition: .3s;
                            border-radius: 22px;
                        "></span>
                        <span class="feature-dot" data-for="feature-autoChest-${odiskd}" style="
                            position: absolute;
                            height: 16px; width: 16px;
                            left: ${hasAutoChest || isAdmin ? '21px' : '3px'}; bottom: 3px;
                            background-color: white;
                            transition: .3s;
                            border-radius: 50%;
                        "></span>
                    </label>
                </div>
                
                <!-- Auto Missions -->
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <label for="feature-autoMissions-${odiskd}" style="color: #ccc; font-size: 13px; cursor: pointer;">Auto Missions</label>
                        ${missionsKilled ? '<span style="background: #ef4444; color: white; font-size: 9px; padding: 2px 5px; border-radius: 3px; font-weight: 600;">KILLED</span>' : ''}
                    </div>
                    <label style="position: relative; display: inline-block; width: 40px; height: 22px; cursor: ${isAdmin ? 'not-allowed' : 'pointer'}; opacity: ${isAdmin ? '0.5' : '1'};">
                        <input type="checkbox" id="feature-autoMissions-${odiskd}" ${hasAutoMissions || isAdmin ? 'checked' : ''} ${isAdmin ? 'disabled' : ''} style="opacity: 0; width: 0; height: 0;">
                        <span class="feature-slider" data-for="feature-autoMissions-${odiskd}" style="
                            position: absolute;
                            cursor: ${isAdmin ? 'not-allowed' : 'pointer'};
                            top: 0; left: 0; right: 0; bottom: 0;
                            background-color: ${hasAutoMissions || isAdmin ? '#22c55e' : '#555'};
                            transition: .3s;
                            border-radius: 22px;
                        "></span>
                        <span class="feature-dot" data-for="feature-autoMissions-${odiskd}" style="
                            position: absolute;
                            height: 16px; width: 16px;
                            left: ${hasAutoMissions || isAdmin ? '21px' : '3px'}; bottom: 3px;
                            background-color: white;
                            transition: .3s;
                            border-radius: 50%;
                        "></span>
                    </label>
                </div>
                
                <!-- Hide Ads -->
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <label for="feature-hideAds-${odiskd}" style="color: #ccc; font-size: 13px; cursor: pointer;">Hide Ads</label>
                    <label style="position: relative; display: inline-block; width: 40px; height: 22px; cursor: ${isAdmin ? 'not-allowed' : 'pointer'}; opacity: ${isAdmin ? '0.5' : '1'};">
                        <input type="checkbox" id="feature-hideAds-${odiskd}" ${hasHideAds || isAdmin ? 'checked' : ''} ${isAdmin ? 'disabled' : ''} style="opacity: 0; width: 0; height: 0;">
                        <span class="feature-slider" data-for="feature-hideAds-${odiskd}" style="
                            position: absolute;
                            cursor: ${isAdmin ? 'not-allowed' : 'pointer'};
                            top: 0; left: 0; right: 0; bottom: 0;
                            background-color: ${hasHideAds || isAdmin ? '#22c55e' : '#555'};
                            transition: .3s;
                            border-radius: 22px;
                        "></span>
                        <span class="feature-dot" data-for="feature-hideAds-${odiskd}" style="
                            position: absolute;
                            height: 16px; width: 16px;
                            left: ${hasHideAds || isAdmin ? '21px' : '3px'}; bottom: 3px;
                            background-color: white;
                            transition: .3s;
                            border-radius: 50%;
                        "></span>
                    </label>
                </div>
                
                <button data-save-features="${odiskd}" style="
                    background: #22c55e;
                    border: none;
                    border-radius: 4px;
                    padding: 6px 12px;
                    color: white;
                    font-size: 12px;
                    cursor: pointer;
                    align-self: flex-end;
                    margin-top: 4px;
                ">Save Features</button>
            </div>
        </div>
        <!-- Settings panel for ${odiskd} -->
        <div id="settings-panel-${odiskd}" style="
            display: none;
            background: #333;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 8px;
            margin-top: -4px;
        ">
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <!-- Border settings -->
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="border-enabled-${odiskd}" ${settings.borderEnabled ? 'checked' : ''} style="cursor: pointer;" />
                    <label style="color: #ccc; font-size: 13px; width: 60px;">Border:</label>
                    <input type="text" id="border-color1-${odiskd}" value="${settings.borderColor1 || ''}" placeholder="#hex" style="
                        width: 70px;
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                    " />
                    <div id="border-preview1-${odiskd}" style="
                        width: 18px;
                        height: 18px;
                        border-radius: 4px;
                        background: ${settings.borderColor1 || '#333'};
                        border: 1px solid #555;
                    "></div>
                    <input type="text" id="border-color2-${odiskd}" value="${settings.borderColor2 || ''}" placeholder="#hex (optional)" style="
                        width: 70px;
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                    " />
                    <div id="border-preview2-${odiskd}" style="
                        width: 18px;
                        height: 18px;
                        border-radius: 4px;
                        background: ${settings.borderColor2 || '#333'};
                        border: 1px solid #555;
                    "></div>
                </div>
                <!-- Level background settings -->
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="level-enabled-${odiskd}" ${settings.levelEnabled ? 'checked' : ''} style="cursor: pointer;" />
                    <label style="color: #ccc; font-size: 13px; width: 60px;">Level:</label>
                    <input type="text" id="level-color1-${odiskd}" value="${settings.levelColor1 || ''}" placeholder="#hex" style="
                        width: 70px;
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                    " />
                    <div id="level-preview1-${odiskd}" style="
                        width: 18px;
                        height: 18px;
                        border-radius: 4px;
                        background: ${settings.levelColor1 || '#333'};
                        border: 1px solid #555;
                    "></div>
                    <input type="text" id="level-color2-${odiskd}" value="${settings.levelColor2 || ''}" placeholder="#hex (optional)" style="
                        width: 70px;
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                    " />
                    <div id="level-preview2-${odiskd}" style="
                        width: 18px;
                        height: 18px;
                        border-radius: 4px;
                        background: ${settings.levelColor2 || '#333'};
                        border: 1px solid #555;
                    "></div>
                </div>
                <!-- Text color settings -->
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="text-enabled-${odiskd}" ${settings.textColor ? 'checked' : ''} style="cursor: pointer;" />
                    <label style="color: #ccc; font-size: 13px; width: 60px;">Name:</label>
                    <input type="text" id="text-color-${odiskd}" value="${settings.textColor || ''}" placeholder="#hex" style="
                        width: 70px;
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                    " />
                    <div id="text-preview-${odiskd}" style="
                        width: 18px;
                        height: 18px;
                        border-radius: 4px;
                        background: ${settings.textColor || '#333'};
                        border: 1px solid #555;
                    "></div>
                </div>
                <!-- Save button -->
                <button data-save-settings="${odiskd}" style="
                    background: #22c55e;
                    border: none;
                    border-radius: 4px;
                    padding: 6px 12px;
                    color: white;
                    font-size: 12px;
                    cursor: pointer;
                    align-self: flex-end;
                ">Save Style</button>
            </div>
        </div>
    `}).join('');

    // Add click handlers for refresh buttons
    container.querySelectorAll('[data-refresh-friend]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const odiskd = btn.getAttribute('data-refresh-friend');
            btn.textContent = '...';
            btn.disabled = true;

            try {
                // Use channelId endpoint to look up by userId
                const response = await fetch(`https://cdn.younow.com/php/api/channel/getInfo/channelId=${odiskd}`);
                const data = await response.json();

                if (data.userId) {
                    const newUsername = data.profile || data.firstName || friendUsers[odiskd]?.username || odiskd;
                    const newAvatar = `https://ynassets.younow.com/user/live/${data.userId}/${data.userId}.jpg`;

                    const oldData = friendUsers[odiskd] || {};
                    const hasChanged = oldData.username !== newUsername || oldData.avatar !== newAvatar;

                    if (hasChanged) {
                        friendUsers[odiskd] = { username: newUsername, avatar: newAvatar };
                        await saveSettingsToFirebase();
                        renderFriendUsernames();
                    } else {
                        btn.textContent = '✓';
                        setTimeout(() => { btn.textContent = '🔄'; btn.disabled = false; }, 1000);
                    }
                } else {
                    btn.textContent = '✗';
                    setTimeout(() => { btn.textContent = '🔄'; btn.disabled = false; }, 1000);
                }
            } catch (e) {
                console.error('Refresh error:', e);
                btn.textContent = '✗';
                setTimeout(() => { btn.textContent = '🔄'; btn.disabled = false; }, 1000);
            }
        });
    });

    // Add click handlers for remove buttons
    container.querySelectorAll('[data-remove-friend]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.getAttribute('data-remove-friend'));
            const odiskd = friendUserIds[index];
            friendUserIds.splice(index, 1);
            // Also remove user data and settings
            delete friendUsers[odiskd];
            delete friendSettings[odiskd];
            renderFriendUsernames();
            await saveSettingsToFirebase();
        });
    });

    // Add click handlers for settings buttons
    container.querySelectorAll('[data-settings-friend]').forEach(btn => {
        btn.addEventListener('click', () => {
            const odiskd = btn.getAttribute('data-settings-friend');
            const panel = document.getElementById(`settings-panel-${odiskd}`);
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        });
    });

    // Add click handlers for features buttons
    container.querySelectorAll('[data-features-friend]').forEach(btn => {
        btn.addEventListener('click', () => {
            const odiskd = btn.getAttribute('data-features-friend');
            const panel = document.getElementById(`features-panel-${odiskd}`);
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        });
    });

    // Helper to update feature toggle slider visuals
    const updateFeatureSliderVisual = (checkbox) => {
        const checkboxId = checkbox.id;
        const slider = container.querySelector(`.feature-slider[data-for="${checkboxId}"]`);
        const dot = container.querySelector(`.feature-dot[data-for="${checkboxId}"]`);
        if (slider && dot) {
            if (checkbox.checked) {
                slider.style.backgroundColor = '#22c55e';
                dot.style.left = '21px';
            } else {
                slider.style.backgroundColor = '#555';
                dot.style.left = '3px';
            }
            // Update opacity/cursor based on disabled state
            const label = slider.closest('label');
            if (label) {
                label.style.opacity = checkbox.disabled ? '0.5' : '1';
                label.style.cursor = checkbox.disabled ? 'not-allowed' : 'pointer';
                slider.style.cursor = checkbox.disabled ? 'not-allowed' : 'pointer';
            }
        }
    };

    // Add click handlers for all feature checkboxes to update slider visuals
    container.querySelectorAll('[id^="feature-"]').forEach(checkbox => {
        if (checkbox.type === 'checkbox') {
            checkbox.addEventListener('change', () => {
                updateFeatureSliderVisual(checkbox);
            });
        }
    });

    // Add change handlers for admin checkboxes (auto-check/disable other features)
    container.querySelectorAll('[id^="feature-admin-"]').forEach(adminCheckbox => {
        adminCheckbox.addEventListener('change', () => {
            const odiskd = adminCheckbox.id.replace('feature-admin-', '');
            const filterBypassCheckbox = document.getElementById(`feature-filterBypass-${odiskd}`);
            const autoChestCheckbox = document.getElementById(`feature-autoChest-${odiskd}`);
            const autoMissionsCheckbox = document.getElementById(`feature-autoMissions-${odiskd}`);
            const hideAdsCheckbox = document.getElementById(`feature-hideAds-${odiskd}`);

            if (adminCheckbox.checked) {
                // Admin checked - check and disable all feature checkboxes
                if (filterBypassCheckbox) {
                    filterBypassCheckbox.checked = true;
                    filterBypassCheckbox.disabled = true;
                    updateFeatureSliderVisual(filterBypassCheckbox);
                }
                if (autoChestCheckbox) {
                    autoChestCheckbox.checked = true;
                    autoChestCheckbox.disabled = true;
                    updateFeatureSliderVisual(autoChestCheckbox);
                }
                if (autoMissionsCheckbox) {
                    autoMissionsCheckbox.checked = true;
                    autoMissionsCheckbox.disabled = true;
                    updateFeatureSliderVisual(autoMissionsCheckbox);
                }
                if (hideAdsCheckbox) {
                    hideAdsCheckbox.checked = true;
                    hideAdsCheckbox.disabled = true;
                    updateFeatureSliderVisual(hideAdsCheckbox);
                }
            } else {
                // Admin unchecked - enable feature checkboxes (keep their checked state)
                if (filterBypassCheckbox) {
                    filterBypassCheckbox.disabled = false;
                    updateFeatureSliderVisual(filterBypassCheckbox);
                }
                if (autoChestCheckbox) {
                    autoChestCheckbox.disabled = false;
                    updateFeatureSliderVisual(autoChestCheckbox);
                }
                if (autoMissionsCheckbox) {
                    autoMissionsCheckbox.disabled = false;
                    updateFeatureSliderVisual(autoMissionsCheckbox);
                }
                if (hideAdsCheckbox) {
                    hideAdsCheckbox.disabled = false;
                    updateFeatureSliderVisual(hideAdsCheckbox);
                }
            }
        });
    });

    // Add handlers for save features buttons
    container.querySelectorAll('[data-save-features]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const odiskd = btn.getAttribute('data-save-features');
            const isAdmin = document.getElementById(`feature-admin-${odiskd}`)?.checked;
            const hasFilterBypass = document.getElementById(`feature-filterBypass-${odiskd}`)?.checked;
            const hasAutoChest = document.getElementById(`feature-autoChest-${odiskd}`)?.checked;
            const hasAutoMissions = document.getElementById(`feature-autoMissions-${odiskd}`)?.checked;
            const hasHideAds = document.getElementById(`feature-hideAds-${odiskd}`)?.checked;

            // Update ADMIN_ONLY_USER_IDS based on admin checkbox
            if (isAdmin) {
                // Add to admin list if not already there
                if (!ADMIN_ONLY_USER_IDS.includes(odiskd) && !ADMIN_ONLY_USER_IDS.includes(String(odiskd))) {
                    ADMIN_ONLY_USER_IDS.push(String(odiskd));
                    // Recompute ADMIN_USER_IDS
                    ADMIN_USER_IDS = [...ADMIN_ONLY_USER_IDS];
                }
            } else {
                // Remove from admin list
                ADMIN_ONLY_USER_IDS = ADMIN_ONLY_USER_IDS.filter(id => id !== odiskd && id !== String(odiskd));
                // Recompute ADMIN_USER_IDS
                ADMIN_USER_IDS = [...ADMIN_ONLY_USER_IDS];
            }

            // Build features array (admin feature is now handled via ADMIN_ONLY_USER_IDS)
            const features = [];
            if (hasFilterBypass) features.push('filterBypass');
            if (hasAutoChest) features.push('autoChest');
            if (hasAutoMissions) features.push('autoMissions');
            if (hasHideAds) features.push('hideAds');

            grantedFeatures[odiskd] = features;

            await saveSettingsToFirebase();

            // Visual feedback
            btn.textContent = 'Saved!';
            setTimeout(() => { btn.textContent = 'Save Features'; }, 1000);
        });
    });

    // Add handlers for color preview updates
    container.querySelectorAll('input[type="text"][id*="-color"]').forEach(input => {
        input.addEventListener('input', () => {
            const id = input.id;
            const previewId = id.replace('-color', '-preview');
            const preview = document.getElementById(previewId);
            const value = normalizeHex(input.value);
            if (preview && /^#[0-9A-Fa-f]{6}$/.test(value)) {
                preview.style.background = value;
            }
        });
    });

    // Add handlers for save buttons
    container.querySelectorAll('[data-save-settings]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const odiskd = btn.getAttribute('data-save-settings');

            const borderEnabled = document.getElementById(`border-enabled-${odiskd}`)?.checked;
            const borderColor1 = normalizeHex(document.getElementById(`border-color1-${odiskd}`)?.value.trim());
            const borderColor2 = normalizeHex(document.getElementById(`border-color2-${odiskd}`)?.value.trim());
            const textEnabled = document.getElementById(`text-enabled-${odiskd}`)?.checked;
            const textColor = normalizeHex(document.getElementById(`text-color-${odiskd}`)?.value.trim());
            const levelEnabled = document.getElementById(`level-enabled-${odiskd}`)?.checked;
            const levelColor1 = normalizeHex(document.getElementById(`level-color1-${odiskd}`)?.value.trim());
            const levelColor2 = normalizeHex(document.getElementById(`level-color2-${odiskd}`)?.value.trim());

            friendSettings[odiskd] = {
                borderEnabled: borderEnabled,
                borderColor1: borderEnabled ? borderColor1 : '',
                borderColor2: borderEnabled ? borderColor2 : '',
                textColor: textEnabled ? textColor : '',
                levelEnabled: levelEnabled,
                levelColor1: levelEnabled ? levelColor1 : '',
                levelColor2: levelEnabled ? levelColor2 : ''
            };

            await saveSettingsToFirebase();
            applyChatStyles();

            // Visual feedback
            btn.textContent = 'Saved!';
            setTimeout(() => { btn.textContent = 'Save Style'; }, 1000);
        });
    });
}

function renderHiddenBroadcasters() {
    const container = document.getElementById('hidden-broadcasters-list');
    if (!container) return;

    container.innerHTML = hiddenUserIds.map((odiskd, index) => {
        const userData = hiddenUsers[odiskd] || {};
        const username = userData.username || odiskd;
        const avatar = userData.avatar || '';
        const exceptions = hiddenExceptions[odiskd] || {};
        const exceptionCount = Object.keys(exceptions).length;

        // Build exception list HTML
        const exceptionListHtml = Object.entries(exceptions).map(([exId, exData]) => `
            <div style="display: flex; align-items: center; justify-content: space-between; background: #333; border-radius: 4px; padding: 6px 10px; margin-top: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="${exData.avatar || ''}" alt="" style="width: 20px; height: 20px; border-radius: 50%; background: #444; display: ${exData.avatar ? 'block' : 'none'};" onerror="this.style.display='none'" />
                    <span style="color: #ccc; font-size: 12px;">${exData.username || exId}</span>
                </div>
                <button data-remove-exception-user="${exId}" data-hidden-id="${odiskd}" style="background: #ef4444; border: none; border-radius: 3px; padding: 2px 6px; color: white; font-size: 10px; cursor: pointer;">✕</button>
            </div>
        `).join('');

        return `
        <div class="hidden-broadcaster-item" style="background: #2a2a2a; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${avatar}" alt="" style="
                        width: 28px;
                        height: 28px;
                        border-radius: 50%;
                        background: #444;
                        display: ${avatar ? 'block' : 'none'};
                    " onerror="this.style.display='none'" />
                    <span style="color: white;">${username}</span>
                </div>
                <div style="display: flex; gap: 6px;">
                    <button data-refresh-hidden="${odiskd}" title="Refresh user" style="
                        background: #666;
                        border: none;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                        cursor: pointer;
                    ">🔄</button>
                    <button data-toggle-exceptions="${odiskd}" title="Exceptions" style="
                        background: #3b82f6;
                        border: none;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                        cursor: pointer;
                    ">👁️</button>
                    <button data-remove-hidden="${index}" style="
                        background: #ef4444;
                        border: none;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                        cursor: pointer;
                    ">Remove</button>
                </div>
            </div>
            <div data-exceptions-panel="${odiskd}" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px solid #444;">
                <p style="color: #888; font-size: 11px; margin: 0 0 6px 0;">Users who can see ${username}:</p>
                <div data-exceptions-list="${odiskd}">${exceptionListHtml}</div>
                <div style="display: flex; gap: 6px; margin-top: 8px;">
                    <input type="text" data-exception-input="${odiskd}" placeholder="Add username" style="
                        flex: 1;
                        background: #333;
                        border: 1px solid #555;
                        border-radius: 4px;
                        padding: 6px 10px;
                        color: white;
                        font-size: 12px;
                        outline: none;
                    " />
                    <button data-add-exception="${odiskd}" style="
                        background: #22c55e;
                        border: none;
                        border-radius: 4px;
                        padding: 6px 12px;
                        color: white;
                        font-size: 12px;
                        cursor: pointer;
                    ">Add</button>
                </div>
            </div>
        </div>
    `}).join('');

    // Add click handlers for toggle exceptions buttons
    container.querySelectorAll('[data-toggle-exceptions]').forEach(btn => {
        btn.addEventListener('click', () => {
            const odiskd = btn.getAttribute('data-toggle-exceptions');
            const panel = container.querySelector(`[data-exceptions-panel="${odiskd}"]`);
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        });
    });

    // Add click handlers for add exception buttons
    container.querySelectorAll('[data-add-exception]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const hiddenId = btn.getAttribute('data-add-exception');
            const input = container.querySelector(`[data-exception-input="${hiddenId}"]`);
            const username = input.value.trim();

            if (!username) return;

            btn.textContent = '...';
            btn.disabled = true;

            try {
                const response = await fetch(`https://cdn.younow.com/php/api/channel/getInfo/user=${username}`);
                const data = await response.json();

                if (!data.userId) {
                    btn.textContent = 'Not found';
                    setTimeout(() => { btn.textContent = 'Add'; btn.disabled = false; }, 1500);
                    return;
                }

                const exceptionId = String(data.userId);

                // Initialize exceptions object for this hidden user if needed
                if (!hiddenExceptions[hiddenId]) {
                    hiddenExceptions[hiddenId] = {};
                }

                // Check for duplicate
                if (hiddenExceptions[hiddenId][exceptionId]) {
                    btn.textContent = 'Already added';
                    setTimeout(() => { btn.textContent = 'Add'; btn.disabled = false; }, 1500);
                    return;
                }

                // Add exception
                hiddenExceptions[hiddenId][exceptionId] = {
                    username: data.profile || username,
                    avatar: `https://ynassets.younow.com/user/live/${data.userId}/${data.userId}.jpg`
                };

                input.value = '';
                await saveSettingsToFirebase();
                renderHiddenBroadcasters();

                // Re-open the panel after re-render
                setTimeout(() => {
                    const newPanel = container.querySelector(`[data-exceptions-panel="${hiddenId}"]`);
                    if (newPanel) newPanel.style.display = 'block';
                }, 0);
            } catch (e) {
                console.error('Error adding exception:', e);
                btn.textContent = 'Error';
                setTimeout(() => { btn.textContent = 'Add'; btn.disabled = false; }, 1500);
            }
        });
    });

    // Add enter key handler for exception inputs
    container.querySelectorAll('[data-exception-input]').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const hiddenId = input.getAttribute('data-exception-input');
                const btn = container.querySelector(`[data-add-exception="${hiddenId}"]`);
                if (btn) btn.click();
            }
        });
    });

    // Add click handlers for remove exception buttons
    container.querySelectorAll('[data-remove-exception-user]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const exceptionId = btn.getAttribute('data-remove-exception-user');
            const hiddenId = btn.getAttribute('data-hidden-id');

            if (hiddenExceptions[hiddenId]) {
                delete hiddenExceptions[hiddenId][exceptionId];
                // Clean up empty objects
                if (Object.keys(hiddenExceptions[hiddenId]).length === 0) {
                    delete hiddenExceptions[hiddenId];
                }
            }

            await saveSettingsToFirebase();
            renderHiddenBroadcasters();

            // Re-open the panel after re-render
            setTimeout(() => {
                const newPanel = container.querySelector(`[data-exceptions-panel="${hiddenId}"]`);
                if (newPanel) newPanel.style.display = 'block';
            }, 0);
        });
    });

    // Add click handlers for refresh buttons
    container.querySelectorAll('[data-refresh-hidden]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const odiskd = btn.getAttribute('data-refresh-hidden');
            btn.textContent = '...';
            btn.disabled = true;

            try {
                // Use channelId endpoint to look up by userId
                const response = await fetch(`https://cdn.younow.com/php/api/channel/getInfo/channelId=${odiskd}`);
                const data = await response.json();

                if (data.userId) {
                    const newUsername = data.profile || data.firstName || hiddenUsers[odiskd]?.username || odiskd;
                    const newAvatar = `https://ynassets.younow.com/user/live/${data.userId}/${data.userId}.jpg`;

                    const oldData = hiddenUsers[odiskd] || {};
                    const hasChanged = oldData.username !== newUsername || oldData.avatar !== newAvatar;

                    if (hasChanged) {
                        hiddenUsers[odiskd] = { username: newUsername, avatar: newAvatar };
                        await saveSettingsToFirebase();
                        renderHiddenBroadcasters();
                    } else {
                        btn.textContent = '✓';
                        setTimeout(() => { btn.textContent = '🔄'; btn.disabled = false; }, 1000);
                    }
                } else {
                    btn.textContent = '✗';
                    setTimeout(() => { btn.textContent = '🔄'; btn.disabled = false; }, 1000);
                }
            } catch (e) {
                console.error('Refresh error:', e);
                btn.textContent = '✗';
                setTimeout(() => { btn.textContent = '🔄'; btn.disabled = false; }, 1000);
            }
        });
    });

    // Add click handlers for remove buttons
    container.querySelectorAll('[data-remove-hidden]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.getAttribute('data-remove-hidden'));
            const odiskd = hiddenUserIds[index];
            hiddenUserIds.splice(index, 1);
            // Also remove user data and exceptions
            delete hiddenUsers[odiskd];
            delete hiddenExceptions[odiskd];
            renderHiddenBroadcasters();
            await saveSettingsToFirebase();
        });
    });
}