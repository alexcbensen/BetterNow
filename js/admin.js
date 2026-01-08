/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

// Admin panel functionality

let verifiedAdmin = null;
let adminButtonPending = false;

// Helper to ensure hex colors have # prefix
function normalizeHex(value) {
    if (!value) return '';
    value = value.trim();
    if (value && !value.startsWith('#')) {
        value = '#' + value;
    }
    return value;
}

async function verifyAdminUser() {
    if (verifiedAdmin !== null) return verifiedAdmin;

    const usernameEl = document.querySelector('app-profile-dropdown .username');
    if (!usernameEl) return false;

    const username = usernameEl.textContent.trim();

    try {
        const response = await fetch(`https://api.younow.com/php/api/broadcast/info/user=${username}`);
        const data = await response.json();
        verifiedAdmin = ADMIN_USER_IDS.includes(data.userId?.toString());
        return verifiedAdmin;
    } catch (e) {
        return false;
    }
}

async function createAdminPanelEntry() {
    if (document.getElementById('admin-panel-btn') || adminButtonPending) return;

    const currenciesWrapper = document.querySelector('app-profile-dropdown .currencies-infos-wrapper > div');
    if (!currenciesWrapper) return;

    adminButtonPending = true;

    const isAdmin = await verifyAdminUser();
    if (!isAdmin) {
        adminButtonPending = false;
        return;
    }

    if (document.getElementById('admin-panel-btn')) {
        adminButtonPending = false;
        return;
    }

    const isSignedIn = !!firebaseIdToken;

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

    // Close button
    const closeBtn = document.getElementById('admin-panel-close');
    closeBtn.addEventListener('click', () => {
        document.body.style.overflow = '';
        overlay.remove();
    });

    // Sign out button
    const lockBtn = document.getElementById('admin-panel-lock');
    lockBtn.addEventListener('click', () => {
        firebaseIdToken = null;
        sessionStorage.removeItem('firebaseIdToken');
        updateAdminIcon();
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

        const isDuplicate = friendUsernames.some(u => u.toLowerCase() === username.toLowerCase());
        if (isDuplicate) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#ef4444';
            statusEl.textContent = `"${username}" is already in friends list`;
            setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
            return;
        }

        friendUsernames.push(username);
        renderFriendUsernames();
        friendInput.value = '';
        await saveSettingsToFirebase();
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

        const isDuplicate = hiddenBroadcasters.some(u => u.toLowerCase() === username.toLowerCase());
        if (isDuplicate) {
            statusEl.style.display = 'block';
            statusEl.style.color = '#ef4444';
            statusEl.textContent = `"${username}" is already in hidden list`;
            setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
            return;
        }

        hiddenBroadcasters.push(username);
        renderHiddenBroadcasters();
        hiddenInput.value = '';
        await saveSettingsToFirebase();
    });
    hiddenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addHiddenBtn.click();
    });

    // Click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.style.overflow = '';
            overlay.remove();
        }
    });
}

function renderFriendUsernames() {
    const container = document.getElementById('friend-usernames-list');
    if (!container) return;

    container.innerHTML = friendUsernames.map((username, index) => {
        const settings = friendSettings[username.toLowerCase()] || {};
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
            <span style="color: white;">${username}</span>
            <div style="display: flex; gap: 6px;">
                <button data-settings-friend="${username}" title="Style settings" style="
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
        <!-- Settings panel for ${username} -->
        <div id="settings-panel-${username.toLowerCase()}" style="
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
                    <input type="checkbox" id="border-enabled-${username.toLowerCase()}" ${settings.borderEnabled ? 'checked' : ''} style="cursor: pointer;" />
                    <label style="color: #ccc; font-size: 13px; width: 60px;">Border:</label>
                    <input type="text" id="border-color1-${username.toLowerCase()}" value="${settings.borderColor1 || ''}" placeholder="#hex" style="
                        width: 70px;
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                    " />
                    <div id="border-preview1-${username.toLowerCase()}" style="
                        width: 18px;
                        height: 18px;
                        border-radius: 4px;
                        background: ${settings.borderColor1 || '#333'};
                        border: 1px solid #555;
                    "></div>
                    <input type="text" id="border-color2-${username.toLowerCase()}" value="${settings.borderColor2 || ''}" placeholder="#hex (optional)" style="
                        width: 70px;
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                    " />
                    <div id="border-preview2-${username.toLowerCase()}" style="
                        width: 18px;
                        height: 18px;
                        border-radius: 4px;
                        background: ${settings.borderColor2 || '#333'};
                        border: 1px solid #555;
                    "></div>
                </div>
                <!-- Text color settings -->
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="text-enabled-${username.toLowerCase()}" ${settings.textColor ? 'checked' : ''} style="cursor: pointer;" />
                    <label style="color: #ccc; font-size: 13px; width: 60px;">Name:</label>
                    <input type="text" id="text-color-${username.toLowerCase()}" value="${settings.textColor || ''}" placeholder="#hex" style="
                        width: 70px;
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                    " />
                    <div id="text-preview-${username.toLowerCase()}" style="
                        width: 18px;
                        height: 18px;
                        border-radius: 4px;
                        background: ${settings.textColor || '#333'};
                        border: 1px solid #555;
                    "></div>
                </div>
                <!-- Level background settings -->
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="level-enabled-${username.toLowerCase()}" ${settings.levelEnabled ? 'checked' : ''} style="cursor: pointer;" />
                    <label style="color: #ccc; font-size: 13px; width: 60px;">Level:</label>
                    <input type="text" id="level-color1-${username.toLowerCase()}" value="${settings.levelColor1 || ''}" placeholder="#hex" style="
                        width: 70px;
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                    " />
                    <div id="level-preview1-${username.toLowerCase()}" style="
                        width: 18px;
                        height: 18px;
                        border-radius: 4px;
                        background: ${settings.levelColor1 || '#333'};
                        border: 1px solid #555;
                    "></div>
                    <input type="text" id="level-color2-${username.toLowerCase()}" value="${settings.levelColor2 || ''}" placeholder="#hex (optional)" style="
                        width: 70px;
                        background: #2a2a2a;
                        border: 1px solid #444;
                        border-radius: 4px;
                        padding: 4px 8px;
                        color: white;
                        font-size: 12px;
                    " />
                    <div id="level-preview2-${username.toLowerCase()}" style="
                        width: 18px;
                        height: 18px;
                        border-radius: 4px;
                        background: ${settings.levelColor2 || '#333'};
                        border: 1px solid #555;
                    "></div>
                </div>
                <!-- Save button -->
                <button data-save-settings="${username}" style="
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

    // Add click handlers for remove buttons
    container.querySelectorAll('[data-remove-friend]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.getAttribute('data-remove-friend'));
            const username = friendUsernames[index];
            friendUsernames.splice(index, 1);
            // Also remove settings for this user
            delete friendSettings[username.toLowerCase()];
            renderFriendUsernames();
            await saveSettingsToFirebase();
        });
    });

    // Add click handlers for settings buttons
    container.querySelectorAll('[data-settings-friend]').forEach(btn => {
        btn.addEventListener('click', () => {
            const username = btn.getAttribute('data-settings-friend');
            const panel = document.getElementById(`settings-panel-${username.toLowerCase()}`);
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
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
            const username = btn.getAttribute('data-save-settings').toLowerCase();

            const borderEnabled = document.getElementById(`border-enabled-${username}`)?.checked;
            const borderColor1 = normalizeHex(document.getElementById(`border-color1-${username}`)?.value.trim());
            const borderColor2 = normalizeHex(document.getElementById(`border-color2-${username}`)?.value.trim());
            const textEnabled = document.getElementById(`text-enabled-${username}`)?.checked;
            const textColor = normalizeHex(document.getElementById(`text-color-${username}`)?.value.trim());
            const levelEnabled = document.getElementById(`level-enabled-${username}`)?.checked;
            const levelColor1 = normalizeHex(document.getElementById(`level-color1-${username}`)?.value.trim());
            const levelColor2 = normalizeHex(document.getElementById(`level-color2-${username}`)?.value.trim());

            friendSettings[username] = {
                borderEnabled: borderEnabled,
                borderColor1: borderEnabled ? borderColor1 : '',
                borderColor2: borderEnabled ? borderColor2 : '',
                textColor: textEnabled ? textColor : '',
                levelEnabled: levelEnabled,
                levelColor1: levelEnabled ? levelColor1 : '',
                levelColor2: levelEnabled ? levelColor2 : ''
            };

            await saveSettingsToFirebase();
            applyBorders();

            // Visual feedback
            btn.textContent = 'Saved!';
            setTimeout(() => { btn.textContent = 'Save Style'; }, 1000);
        });
    });
}

function renderHiddenBroadcasters() {
    const container = document.getElementById('hidden-broadcasters-list');
    if (!container) return;

    container.innerHTML = hiddenBroadcasters.map((username, index) => `
        <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #2a2a2a;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 6px;
        ">
            <span style="color: white;">${username}</span>
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
    `).join('');

    // Add click handlers for remove buttons
    container.querySelectorAll('[data-remove-hidden]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.getAttribute('data-remove-hidden'));
            hiddenBroadcasters.splice(index, 1);
            renderHiddenBroadcasters();
            await saveSettingsToFirebase();
        });
    });
}