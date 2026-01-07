const myUsernames = ["Alex"];
const friendUsernames = ["Menacing", "JusWithoutTheTin", "ThatDudeJon", "TeressaMarie"];
const hiddenBroadcasters = ["mcfroger3", "unhingedfaerie", "StonrZax"];

const gradients = {
    300: "linear-gradient(115.62deg, rgb(0, 200, 170) 17.43%, rgb(0, 150, 200) 84.33%)",
    800: "linear-gradient(115.62deg, rgb(100, 100, 200) 17.43%, rgb(150, 100, 220) 84.33%)",
    1000: "linear-gradient(115.62deg, rgb(0, 200, 255) 17.43%, rgb(200, 150, 255) 84.33%)",
    1200: "linear-gradient(115.62deg, rgb(255, 200, 200) 17.43%, rgb(255, 255, 150) 84.33%)",
    1400: "linear-gradient(115.62deg, rgb(255, 220, 100) 17.43%, rgb(255, 180, 200) 84.33%)",
    1600: "linear-gradient(115.62deg, rgb(255, 200, 100) 17.43%, rgb(255, 100, 150) 84.33%)",
    1800: "linear-gradient(115.62deg, rgb(255, 50, 150) 17.43%, rgb(200, 50, 255) 84.33%)",
    2000: "linear-gradient(115.62deg, rgb(255, 100, 150) 17.43%, rgb(200, 50, 200) 84.33%)",
    2500: "linear-gradient(115.62deg, rgb(255, 0, 81) 17.43%, rgb(128, 0, 148) 84.33%)",
    6767: "linear-gradient(115.62deg, rgb(255, 215, 0) 17.43%, rgb(255, 180, 0) 84.33%)",
    6969: "linear-gradient(115.62deg, rgb(255, 184, 57) 17.43%, rgb(255, 184, 57) 84.33%)"
};

const myGradient = gradients[6969];
const friendGradient = gradients[1000];
const myTextColor = "#FFD700";
const friendTextColor = "#FFFFFF";

let gridViewEnabled = false;

// Admin panel settings
const ADMIN_USERNAME = "Alex";

function isAdminUnlocked() {
    return sessionStorage.getItem('adminUnlocked') === 'true';
}

function unlockAdmin() {
    sessionStorage.setItem('adminUnlocked', 'true');
}

async function hashPIN(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getStoredPIN() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['adminPINHash'], (result) => {
            resolve(result.adminPINHash || null);
        });
    });
}

function setStoredPIN(pinHash) {
    return new Promise((resolve) => {
        chrome.storage.sync.set({ adminPINHash: pinHash }, () => {
            resolve();
        });
    });
}

function createAdminPanelEntry() {
    const currenciesWrapper = document.querySelector('app-profile-dropdown .currencies-infos-wrapper > div');
    if (!currenciesWrapper || document.getElementById('admin-panel-btn')) return;

    // Check if user is Alex
    const usernameEl = document.querySelector('app-profile-dropdown .username');
    if (!usernameEl || usernameEl.textContent.trim() !== ADMIN_USERNAME) return;

    const isUnlocked = isAdminUnlocked();

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
    adminBtn.innerHTML = `<i class="bi ${isUnlocked ? 'bi-unlock-fill' : 'bi-lock-fill'}" id="admin-lock-icon"></i><span>Admin Panel</span>`;
    adminBtn.title = 'Admin Panel';

    adminBtn.addEventListener('click', handleAdminClick);

    // Find the Get Bars & Pearls button and insert after it
    const barsBtn = currenciesWrapper.querySelector('.button--purple');
    if (barsBtn) {
        barsBtn.parentNode.insertBefore(adminBtn, barsBtn.nextSibling);
    }
}

async function handleAdminClick() {
    // Close the profile dropdown popover
    const popover = document.querySelector('ngb-popover-window');
    if (popover) popover.remove();

    // Also try clicking outside to close it
    document.body.click();

    if (isAdminUnlocked()) {
        openAdminPanel();
    } else {
        const storedPIN = await getStoredPIN();
        if (storedPIN) {
            showPinPrompt();
        } else {
            showCreatePinPrompt();
        }
    }
}

function createOverlay(id, content) {
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    overlay.innerHTML = content;
    return overlay;
}

function showCreatePinPrompt() {
    const existing = document.getElementById('admin-pin-overlay');
    if (existing) existing.remove();

    const overlay = createOverlay('admin-pin-overlay', templates.createPinPrompt);
    document.body.appendChild(overlay);

    const pinInput = document.getElementById('admin-pin-input');
    const confirmInput = document.getElementById('admin-pin-confirm');
    const submitBtn = document.getElementById('admin-pin-submit');
    const cancelBtn = document.getElementById('admin-pin-cancel');
    const errorMsg = document.getElementById('admin-pin-error');

    pinInput.focus();

    const tryCreate = async () => {
        const pin = pinInput.value;
        const confirm = confirmInput.value;

        if (pin.length < 4) {
            errorMsg.textContent = 'PIN must be at least 4 characters';
            errorMsg.style.display = 'block';
            return;
        }

        if (pin !== confirm) {
            errorMsg.textContent = 'PINs do not match';
            errorMsg.style.display = 'block';
            confirmInput.value = '';
            confirmInput.focus();
            return;
        }

        const pinHash = await hashPIN(pin);
        await setStoredPIN(pinHash);
        unlockAdmin();
        overlay.remove();
        updateAdminIcon();
        openAdminPanel();
    };

    submitBtn.addEventListener('click', tryCreate);
    confirmInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') tryCreate();
    });
    cancelBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

function showPinPrompt() {
    const existing = document.getElementById('admin-pin-overlay');
    if (existing) existing.remove();

    const overlay = createOverlay('admin-pin-overlay', templates.pinPrompt);
    document.body.appendChild(overlay);

    const input = document.getElementById('admin-pin-input');
    const submitBtn = document.getElementById('admin-pin-submit');
    const cancelBtn = document.getElementById('admin-pin-cancel');
    const errorMsg = document.getElementById('admin-pin-error');

    input.focus();

    const tryUnlock = async () => {
        const storedHash = await getStoredPIN();
        const inputHash = await hashPIN(input.value);
        if (inputHash === storedHash) {
            unlockAdmin();
            overlay.remove();
            updateAdminIcon();
            openAdminPanel();
        } else {
            errorMsg.style.display = 'block';
            input.value = '';
            input.focus();
        }
    };

    submitBtn.addEventListener('click', tryUnlock);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') tryUnlock();
    });
    cancelBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

function updateAdminIcon() {
    const icon = document.getElementById('admin-lock-icon');
    if (icon) {
        icon.className = isAdminUnlocked() ? 'bi bi-unlock-fill' : 'bi bi-lock-fill';
    }
}

function openAdminPanel() {
    const existing = document.getElementById('admin-panel-overlay');
    if (existing) existing.remove();

    const overlay = createOverlay('admin-panel-overlay', templates.adminPanel);
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('admin-panel-close');
    closeBtn.addEventListener('click', () => overlay.remove());

    const lockBtn = document.getElementById('admin-panel-lock');
    lockBtn.addEventListener('click', () => {
        sessionStorage.removeItem('adminUnlocked');
        updateAdminIcon();
        overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// Debounce for carousel skipping - prevent rapid clicks
let lastSkipTime = 0;
const SKIP_COOLDOWN = 1000; // 1 second between skips

// Track navigation direction: 'next' or 'prev'
let lastDirection = 'next';

function applyBorders() {
    myUsernames.forEach(username => {
        document.querySelectorAll(`span[title="${username}"]`).forEach(span => {
            const li = span.closest('li');
            if (li && li.closest('app-chat-list')) {
                const card = li.querySelector('.user-card');
                if (card) {
                    card.style.border = '1px solid transparent';
                    card.style.borderRadius = '8px';
                    card.style.backgroundImage = `linear-gradient(#212121, #212121), ${myGradient}`;
                    card.style.backgroundOrigin = 'border-box';
                    card.style.backgroundClip = 'padding-box, border-box';
                }

                const comment = li.querySelector('.comment');
                if (comment) {
                    comment.className = 'comment ng-star-inserted';
                }

                const levelBadge = li.querySelector('app-user-level .user-level');
                if (levelBadge) {
                    levelBadge.style.background = myGradient;
                    levelBadge.style.borderRadius = '9px';
                    levelBadge.style.padding = '.125rem .5rem';
                    levelBadge.style.color = '#fff';
                }

                const usernameSpan = li.querySelector(`span[title="${username}"]`);
                if (usernameSpan) {
                    usernameSpan.style.setProperty('color', myTextColor, 'important');
                }

                const avatarThumb = li.querySelector('app-user-thumb .user-thumb');
                if (avatarThumb) {
                    // Add the border image around avatar
                    const existingBorder = avatarThumb.querySelector('.custom-avatar-border');
                    if (!existingBorder) {
                        const borderImg = document.createElement('img');
                        borderImg.src = chrome.runtime.getURL('golden-border-2.svg');
                        borderImg.className = 'custom-avatar-border';
                        borderImg.style.cssText = `
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            width: calc(100% + 6px);
                            height: calc(100% + 6px);
                            pointer-events: none;
                            z-index: 1;
                        `;
                        avatarThumb.style.position = 'relative';
                        avatarThumb.appendChild(borderImg);
                    }
                }
            }
        });
    });

    friendUsernames.forEach(username => {
        document.querySelectorAll(`span[title="${username}"]`).forEach(span => {
            const li = span.closest('li');
            if (li && li.closest('app-chat-list')) {
                const card = li.querySelector('.user-card');
                if (card) {
                    card.style.border = '1px solid transparent';
                    card.style.borderRadius = '8px';
                    card.style.backgroundImage = `linear-gradient(#212121, #212211), ${friendGradient}`;
                    card.style.backgroundOrigin = 'border-box';
                    card.style.backgroundClip = 'padding-box, border-box';
                }

                const comment = li.querySelector('.comment');
                if (comment) {
                    comment.className = 'comment ng-star-inserted';
                }

                const usernameSpan = li.querySelector(`span[title="${username}"]`);
                if (usernameSpan) {
                    usernameSpan.style.setProperty('color', friendTextColor, 'important');
                }
            }
        });
    });
}

function hideBroadcasters() {
    hiddenBroadcasters.forEach(username => {
        document.querySelectorAll(`a[href="/${username}"]`).forEach(el => {
            const card = el.closest('li');
            if (card && !card.closest('app-broadcasts-carousel')) {
                card.style.display = 'none';
            }
        });
    });
}

// Set up listeners to track which direction user is navigating
function setupCarouselDirectionTracking() {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (!carousel || carousel.dataset.directionTracked) return;

    const prevBtn = carousel.querySelector('.button--prev');
    const nextBtn = carousel.querySelector('.button--next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            lastDirection = 'prev';
        }, true);
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            lastDirection = 'next';
        }, true);
    }

    carousel.dataset.directionTracked = 'true';
}

function hideCarouselBroadcasters() {
    const carousel = document.querySelector('app-broadcasts-carousel');
    if (!carousel) return;

    // Set up direction tracking if not already done
    setupCarouselDirectionTracking();

    const entries = carousel.querySelectorAll('.list__entry');
    const now = Date.now();

    entries.forEach(entry => {
        // Check if this is the active/center entry (has disabled button)
        const isActive = entry.querySelector('button.entry__button[disabled]') !== null;

        if (isActive) {
            // Active entry has username visible - check if it's a hidden broadcaster
            const usernameEl = entry.querySelector('h5.username') ||
                entry.querySelector('.toolbar .username span');

            if (usernameEl) {
                const username = usernameEl.textContent.trim();
                const isHidden = hiddenBroadcasters.some(hidden =>
                    hidden.toLowerCase() === username.toLowerCase()
                );

                if (isHidden) {
                    // Auto-skip in the same direction user was going (with cooldown)
                    if (now - lastSkipTime > SKIP_COOLDOWN) {
                        lastSkipTime = now;

                        // Choose button based on last navigation direction
                        const btnClass = lastDirection === 'prev' ? '.button--prev' : '.button--next';
                        const skipBtn = carousel.querySelector(btnClass);

                        if (skipBtn) {
                            // Small delay to let carousel settle
                            setTimeout(() => {
                                skipBtn.click();
                            }, 100);
                        }
                    }
                }
            }
        }
    });
}

function createGridToggle() {
    if (document.getElementById('grid-toggle-btn')) return;

    const buttonWrapper = document.querySelector('.top-button-wrapper');
    if (!buttonWrapper) return;

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'grid-toggle-btn';
    toggleBtn.innerHTML = '⊞';
    toggleBtn.title = 'Toggle Grid View';
    toggleBtn.style.cssText = `
        background: ${gridViewEnabled ? '#22c55e' : 'transparent'};
        border: 1px solid #555;
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 24px;
        display: inline-block;
        text-align: center;
        line-height: 34px;
        padding: 0;
        margin-right: 10px;
        font-family: proxima-nova, sans-serif;
    `;

    toggleBtn.onclick = () => {
        gridViewEnabled = !gridViewEnabled;
        toggleBtn.style.background = gridViewEnabled ? '#22c55e' : 'transparent';
        applyGridView();
    };

    buttonWrapper.insertBefore(toggleBtn, buttonWrapper.firstChild);
}

function applyGridView() {
    if (gridViewEnabled) {
        document.body.classList.add('grid-view-enabled');
    } else {
        document.body.classList.remove('grid-view-enabled');
    }
}

function fixVideoFit() {
    const allVideos = document.querySelectorAll('.video-player video');

    allVideos.forEach(video => {
        if (video.classList.contains('is-screenshare')) {
            video.style.objectFit = 'contain';
        } else {
            video.style.objectFit = 'cover';
        }
    });
}

const observer = new MutationObserver(() => {
    hideBroadcasters();
    hideCarouselBroadcasters();
});

// Watch for new chat messages to apply borders instantly
let chatObserver = null;

function observeChat() {
    const chatContainer = document.querySelector('app-chat-list');
    if (chatContainer && !chatContainer.hasAttribute('data-observing')) {
        chatObserver = new MutationObserver(() => {
            applyBorders();
        });
        chatObserver.observe(chatContainer, { childList: true, subtree: true });
        chatContainer.setAttribute('data-observing', 'true');
    }
}

applyBorders();
hideBroadcasters();
hideCarouselBroadcasters();

// Apply borders again after a delay to catch messages loaded after initial render
setTimeout(applyBorders, 500);
setTimeout(applyBorders, 1500);
setTimeout(applyBorders, 3000);

setInterval(createGridToggle, 1000);
setInterval(applyGridView, 1000);
setInterval(observeChat, 1000); // Keep trying to attach observer
setInterval(fixVideoFit, 1000);
setInterval(hideCarouselBroadcasters, 200);

// Watch for profile popover to add admin button instantly
const popoverObserver = new MutationObserver(() => {
    createAdminPanelEntry();
});
popoverObserver.observe(document.body, { childList: true, subtree: true });

observer.observe(document.body, {
    childList: true,
    subtree: true
});