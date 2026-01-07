// Admin panel functionality

let verifiedAdmin = null;
let adminButtonPending = false;

async function verifyAdminUser() {
    if (verifiedAdmin !== null) return verifiedAdmin;

    const usernameEl = document.querySelector('app-profile-dropdown .username');
    if (!usernameEl) return false;

    const username = usernameEl.textContent.trim();

    try {
        const response = await fetch(`https://api.younow.com/php/api/broadcast/info/user=${username}`);
        const data = await response.json();
        verifiedAdmin = data.userId?.toString() === ADMIN_USER_ID;
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
            console.log('Sign-in cancelled');
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
    console.log('openAdminPanel called');

    const existing = document.getElementById('admin-panel-overlay');
    if (existing) existing.remove();

    const overlay = createOverlay('admin-panel-overlay', templates.adminPanel);
    document.body.appendChild(overlay);

    console.log('Overlay created');

    // Populate lists
    renderFriendUsernames();
    renderHiddenBroadcasters();

    console.log('Lists rendered');

    // Close button
    const closeBtn = document.getElementById('admin-panel-close');
    console.log('Close btn:', closeBtn);
    closeBtn.addEventListener('click', () => overlay.remove());

    // Sign out button
    const lockBtn = document.getElementById('admin-panel-lock');
    console.log('Lock btn:', lockBtn);
    lockBtn.addEventListener('click', () => {
        firebaseIdToken = null;
        sessionStorage.removeItem('firebaseIdToken');
        updateAdminIcon();
        overlay.remove();
    });

    // Add friend username
    const addFriendBtn = document.getElementById('add-friend-btn');
    const friendInput = document.getElementById('friend-username-input');
    console.log('Add friend btn:', addFriendBtn);
    console.log('Friend input:', friendInput);

    addFriendBtn.addEventListener('click', () => {
        console.log('Add friend clicked');
        const username = friendInput.value.trim();
        if (username && !friendUsernames.includes(username)) {
            friendUsernames.push(username);
            renderFriendUsernames();
            friendInput.value = '';
        }
    });
    friendInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addFriendBtn.click();
    });

    // Add hidden broadcaster
    const addHiddenBtn = document.getElementById('add-hidden-btn');
    const hiddenInput = document.getElementById('hidden-broadcaster-input');
    console.log('Add hidden btn:', addHiddenBtn);

    addHiddenBtn.addEventListener('click', () => {
        console.log('Add hidden clicked');
        const username = hiddenInput.value.trim();
        if (username && !hiddenBroadcasters.includes(username)) {
            hiddenBroadcasters.push(username);
            renderHiddenBroadcasters();
            hiddenInput.value = '';
        }
    });
    hiddenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addHiddenBtn.click();
    });

    // Save button
    const saveBtn = document.getElementById('admin-save-btn');
    console.log('Save btn:', saveBtn);
    saveBtn.addEventListener('click', saveSettingsToFirebase);

    console.log('All event listeners attached');

    // Click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

function renderFriendUsernames() {
    const container = document.getElementById('friend-usernames-list');
    if (!container) return;

    container.innerHTML = friendUsernames.map((username, index) => `
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
    `).join('');

    // Add click handlers for remove buttons
    container.querySelectorAll('[data-remove-friend]').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.getAttribute('data-remove-friend'));
            friendUsernames.splice(index, 1);
            renderFriendUsernames();
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
        btn.addEventListener('click', () => {
            const index = parseInt(btn.getAttribute('data-remove-hidden'));
            hiddenBroadcasters.splice(index, 1);
            renderHiddenBroadcasters();
        });
    });
}