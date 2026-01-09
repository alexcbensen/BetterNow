/*
 * Alex's BetterNow
 * Copyright (c) 2026 Alex
 * All rights reserved.
 *
 * This code may not be copied, modified, or distributed without permission.
 */

// Chat, grid view, carousel, and chest features

let gridViewEnabled = false;
let lastSkipTime = 0;
let lastDirection = 'next';
let chestObserver = null;
let isOpeningChest = false;
let lastCheckedLikes = null;

// ============ Chest Auto-Drop ============

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
    const likeIcon = document.querySelector('.toolbar .ynicon-like');
    if (!likeIcon) return null;

    const valueDiv = likeIcon.parentElement?.querySelector('.toolbar__value');
    if (!valueDiv) return null;

    return parseDisplayLikes(valueDiv.textContent);
}

function isBroadcasting() {
    // Check if the END button exists (only visible when broadcasting)
    return document.querySelector('.toolbar .button--red') !== null;
}

function createChestControls() {
    if (!isBroadcasting()) return;
    if (document.getElementById('auto-chest-controls')) return;

    // Don't show on excluded pages
    if (EXCLUDED_FROM_AUTO_CHEST.some(name => window.location.pathname.toLowerCase() === '/' + name)) return;

    // Don't show if user doesn't have a chest
    if (!document.querySelector('.chest-button')) return;

    const toolbar = document.querySelector('.toolbar__left');
    if (!toolbar) return;

    // Find the Screenshare button entry
    const screenshareEntry = Array.from(toolbar.querySelectorAll('.toolbar__entry')).find(entry => {
        const btn = entry.querySelector('button');
        return btn && btn.textContent.includes('Screenshare');
    });

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

    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'auto-chest-controls';
    controlsDiv.className = 'toolbar__entry';
    controlsDiv.innerHTML = `
        <div class="toolbar__content" style="display: flex; align-items: center; gap: 8px;">
            <button id="auto-chest-toggle" title="Auto Chest Drop" style="
                background: var(--background-color, #212121);
                border: 1px solid ${autoChestEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--main-border-color, #4e4e4e)'};
                border-radius: 2rem;
                padding: .1rem .75rem;
                color: ${autoChestEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-text, white)'};
                font-size: .8rem;
                font-weight: 600;
                font-family: inherit;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
                outline: none;
            ">
                <span>🎁</span>
                <span>Auto</span>
            </button>
            <div id="chest-threshold-controls" style="display: ${autoChestEnabled ? 'flex' : 'none'}; align-items: center; gap: 8px;">
                <input id="chest-threshold-input" type="text" value="${autoChestThreshold ? autoChestThreshold.toLocaleString() : ''}" placeholder="Likes" style="
                    width: 70px;
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
                " title="Drop chest every X likes" />
                <button id="chest-threshold-update" style="
                    background: var(--background-color, #212121);
                    border: 1px solid var(--main-border-color, #4e4e4e);
                    border-radius: 2rem;
                    padding: .1rem .75rem;
                    color: var(--color-text, white);
                    font-size: .8rem;
                    font-weight: 600;
                    font-family: inherit;
                    cursor: pointer;
                    outline: none;
                ">Set</button>
                <span id="chest-update-status" style="
                    color: var(--color-primary-green, #08d687);
                    font-size: .75rem;
                    font-weight: 600;
                "></span>
            </div>
        </div>
    `;

    // Insert after Screenshare button, or at end of toolbar__left
    if (screenshareEntry && screenshareEntry.nextSibling) {
        toolbar.insertBefore(controlsDiv, screenshareEntry.nextSibling);
    } else {
        toolbar.appendChild(controlsDiv);
    }

    // Toggle button
    const toggleBtn = document.getElementById('auto-chest-toggle');
    const thresholdControls = document.getElementById('chest-threshold-controls');

    toggleBtn.addEventListener('click', () => {
        autoChestEnabled = !autoChestEnabled;
        toggleBtn.style.borderColor = autoChestEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--main-border-color, #4e4e4e)';
        toggleBtn.style.color = autoChestEnabled ? 'var(--color-primary-green, #08d687)' : 'var(--color-text, white)';
        thresholdControls.style.display = autoChestEnabled ? 'flex' : 'none';

        if (autoChestEnabled) {
            startChestMonitoring();
        } else {
            stopChestMonitoring();
        }

        saveChestSettingsLocal();
    });

    // Threshold update button
    const thresholdInput = document.getElementById('chest-threshold-input');
    const updateBtn = document.getElementById('chest-threshold-update');
    const updateStatus = document.getElementById('chest-update-status');

    // Format input with commas as user types
    thresholdInput.addEventListener('input', () => {
        // Strip non-digits, parse, and reformat
        const raw = thresholdInput.value.replace(/[^\d]/g, '');
        if (raw) {
            const num = parseInt(raw);
            thresholdInput.value = num.toLocaleString();
        }
    });

    updateBtn.addEventListener('click', () => {
        // Strip commas before parsing
        const value = parseInt(thresholdInput.value.replace(/,/g, ''));
        if (!isNaN(value) && value > 0) {
            autoChestThreshold = value;
            saveChestSettingsLocal();

            // Reformat with commas
            thresholdInput.value = value.toLocaleString();

            // Show status
            updateStatus.textContent = 'Set!';
            setTimeout(() => {
                updateStatus.textContent = '';
            }, 1500);
        } else {
            // Show error
            updateStatus.style.color = '#ef4444';
            updateStatus.textContent = 'Invalid';
            setTimeout(() => {
                updateStatus.textContent = '';
                updateStatus.style.color = 'var(--color-primary-green, #08d687)';
            }, 1500);
        }
    });
}

function removeChestControls() {
    const controls = document.getElementById('auto-chest-controls');
    if (controls) {
        controls.remove();
    }
}

function isChestDropping() {
    // Check if the chest lottie animation is visible (chest is currently dropping)
    return document.querySelector('app-chest-lottie') !== null;
}

async function checkChestThreshold() {
    if (!autoChestEnabled || !isBroadcasting() || isOpeningChest) return;
    if (autoChestThreshold === null || autoChestThreshold <= 0) return;
    if (isChestDropping()) return;

    const currentLikes = getCurrentLikesFromToolbar();
    if (currentLikes === null) return;

    // Only check if likes changed
    if (currentLikes === lastCheckedLikes) return;
    lastCheckedLikes = currentLikes;
    saveChestSettingsLocal();

    // Detect new broadcast (likes reset or lower than last opened)
    if (currentLikes < lastChestOpenLikes) {
        lastChestOpenLikes = 0;
        saveChestSettingsLocal();
    }

    // Calculate chest count
    const chestCount = currentLikes - lastChestOpenLikes;

    // Check if threshold reached
    if (chestCount >= autoChestThreshold) {
        await openChest(currentLikes);
    }
}

function saveChestSettingsLocal() {
    localStorage.setItem('betternow_autoChestEnabled', autoChestEnabled);
    localStorage.setItem('betternow_autoChestThreshold', autoChestThreshold);
    localStorage.setItem('betternow_lastChestOpenLikes', lastChestOpenLikes);
    localStorage.setItem('betternow_lastCheckedLikes', lastCheckedLikes);
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
}

// Load chest settings on startup
loadChestSettingsLocal();

async function openChest(currentLikes) {
    isOpeningChest = true;

    // Click the chest button
    const chestButton = document.querySelector('.chest-button');
    if (!chestButton) {
        isOpeningChest = false;
        return;
    }

    chestButton.click();

    // Wait for modal to appear
    await new Promise(resolve => setTimeout(resolve, 100));

    // Wait for Open button to appear (poll for up to 2 seconds)
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

    if (openButton) {
        openButton.click();

        // Wait for Make it Rain button to appear (poll for up to 2 seconds)
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

        if (rainButton) {
            rainButton.click();

            // Update tracking
            lastChestOpenLikes = currentLikes;
            saveChestSettingsLocal();

            // Wait a bit for the chest animation/modal transition
            await new Promise(resolve => setTimeout(resolve, 500));

            // Wait for "I'll Tell Them!" button to appear (poll for up to 2 seconds)
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
                tellButton.click();
            }
        }
    }

    // Wait a bit before allowing another check
    await new Promise(resolve => setTimeout(resolve, 500));
    isOpeningChest = false;
}

function startChestMonitoring() {
    if (chestObserver) return;

    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;

    chestObserver = new MutationObserver(() => {
        checkChestThreshold();
    });

    chestObserver.observe(toolbar, {
        childList: true,
        subtree: true,
        characterData: true
    });
}

function stopChestMonitoring() {
    if (chestObserver) {
        chestObserver.disconnect();
        chestObserver = null;
    }
}

function checkBroadcastStatus() {
    if (isBroadcasting()) {
        createChestControls();
        if (autoChestEnabled) {
            startChestMonitoring();
        }
    } else {
        removeChestControls();
        stopChestMonitoring();
    }
}

// ============ Chat Styling ============

function applyBorders() {
    // Apply borders for my username
    document.querySelectorAll(`span[title="${myUsername}"]`).forEach(span => {
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

            const usernameSpan = li.querySelector(`span[title="${myUsername}"]`);
            if (usernameSpan) {
                usernameSpan.style.setProperty('color', myTextColor, 'important');
            }

            const avatarThumb = li.querySelector('app-user-thumb .user-thumb');
            if (avatarThumb) {
                const existingBorder = avatarThumb.querySelector('.custom-avatar-border');
                if (!existingBorder) {
                    const borderImg = document.createElement('img');
                    borderImg.src = chrome.runtime.getURL('assets/golden-border-2.svg');
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

    // Apply borders for friend usernames
    friendUserIds.forEach(odiskd => {
        const userData = friendUsers[odiskd] || {};
        const username = userData.username;
        if (!username) return;

        const settings = friendSettings[odiskd] || {};

        document.querySelectorAll(`span[title="${username}"]`).forEach(span => {
            const li = span.closest('li');
            if (li && li.closest('app-chat-list')) {
                const card = li.querySelector('.user-card');

                // Apply border if enabled
                if (card && settings.borderEnabled && settings.borderColor1) {
                    card.style.border = '2px solid transparent';
                    card.style.borderRadius = '8px';

                    // Use gradient if two colors provided, otherwise solid color
                    if (settings.borderColor2) {
                        card.style.backgroundImage = `linear-gradient(#212121, #212121), linear-gradient(115.62deg, ${settings.borderColor1} 17.43%, ${settings.borderColor2} 84.33%)`;
                        card.style.backgroundOrigin = 'border-box';
                        card.style.backgroundClip = 'padding-box, border-box';
                    } else {
                        card.style.borderColor = settings.borderColor1;
                        card.style.backgroundImage = '';
                        card.style.backgroundOrigin = '';
                        card.style.backgroundClip = '';
                    }
                }

                const comment = li.querySelector('.comment');
                if (comment) {
                    comment.className = 'comment ng-star-inserted';
                }

                // Apply text color if set
                if (settings.textColor) {
                    const usernameSpan = li.querySelector(`span[title="${username}"]`);
                    if (usernameSpan) {
                        usernameSpan.style.setProperty('color', settings.textColor, 'important');
                    }
                }

                // Apply level background if enabled
                if (settings.levelEnabled && settings.levelColor1) {
                    const levelBadge = li.querySelector('app-user-level .user-level');
                    if (levelBadge) {
                        // Use gradient if two colors provided, otherwise solid color
                        if (settings.levelColor2) {
                            levelBadge.style.background = `linear-gradient(115.62deg, ${settings.levelColor1} 17.43%, ${settings.levelColor2} 84.33%)`;
                        } else {
                            levelBadge.style.background = settings.levelColor1;
                        }
                        levelBadge.style.borderRadius = '9px';
                        levelBadge.style.padding = '.125rem .5rem';
                        levelBadge.style.color = '#fff';
                    }
                }
            }
        });
    });
}

function observeChat() {
    const chatContainer = document.querySelector('app-chat-list');
    if (chatContainer && !chatContainer.hasAttribute('data-observing')) {
        const chatObserver = new MutationObserver(() => {
            applyBorders();
        });
        chatObserver.observe(chatContainer, { childList: true, subtree: true });
        chatContainer.setAttribute('data-observing', 'true');
    }
}

// ============ Grid View ============

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

// Observer to remove is-small class in grid view (prevents avatar shrinking)
const audioSmallObserver = new MutationObserver((mutations) => {
    if (!document.body.classList.contains('grid-view-enabled')) return;

    for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const el = mutation.target;
            if (el.classList.contains('audio-animation-wrapper') && el.classList.contains('is-small')) {
                el.classList.remove('is-small');
            }
        }
    }
});
audioSmallObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });

function fixVideoFit() {
    const isGridView = document.body.classList.contains('grid-view-enabled');
    const allVideos = document.querySelectorAll('.video-player video');

    allVideos.forEach(video => {
        const videoTile = video.closest('.video');

        if (video.classList.contains('is-screenshare')) {
            // Screenshare: show full content
            video.style.objectFit = 'contain';
        } else {
            // Regular video: fill the frame (may crop edges)
            video.style.objectFit = 'cover';
        }

        // Clear any custom aspect ratio
        if (videoTile) {
            videoTile.style.aspectRatio = '';
        }
    });
}

// ============ Carousel / Hidden Broadcasters ============

function hideNotifications() {
    // Hide notifications from hidden users
    hiddenUserIds.forEach(odiskd => {
        // Check if current user is an exception for this specific hidden broadcaster
        const exceptions = hiddenExceptions[odiskd] || {};
        if (currentUserId && exceptions[currentUserId]) {
            return;
        }

        const userData = hiddenUsers[odiskd] || {};
        const username = userData.username;

        if (username) {
            // Find notifications that mention this username
            document.querySelectorAll('.notifications-list app-notification').forEach(notification => {
                const usernameEl = notification.querySelector('.user-card__right b');
                if (usernameEl && usernameEl.textContent.trim().toLowerCase() === username.toLowerCase()) {
                    notification.style.display = 'none';
                }

                // Also hide notifications that mention the hidden user in the text
                const textEl = notification.querySelector('.user-card__right');
                if (textEl && textEl.textContent.toLowerCase().includes(username.toLowerCase())) {
                    notification.style.display = 'none';
                }
            });
        }

        // Also hide by avatar URL containing userId
        document.querySelectorAll(`.notifications-list app-notification img.avatar[src*="/${odiskd}/"]`).forEach(img => {
            const notification = img.closest('app-notification');
            if (notification) {
                notification.style.display = 'none';
            }
        });
    });
}

function hideBroadcasters() {
    hiddenUserIds.forEach(odiskd => {
        // Check if current user is an exception for this specific hidden broadcaster
        const exceptions = hiddenExceptions[odiskd] || {};
        if (currentUserId && exceptions[currentUserId]) {
            // Current user is exempt from seeing this hidden broadcaster hidden
            return;
        }

        const userData = hiddenUsers[odiskd] || {};
        const username = userData.username;

        // Hide by username link
        if (username) {
            document.querySelectorAll(`a[href="/${username}"]`).forEach(el => {
                const card = el.closest('li');
                if (card && !card.closest('app-broadcasts-carousel')) {
                    card.style.display = 'none';
                }
            });
        }

        // Hide streams where hidden user is guesting (by their avatar URL containing userId)
        document.querySelectorAll(`app-trending-user-guests img.avatar[src*="/${odiskd}/"]`).forEach(img => {
            const card = img.closest('app-trending-user');
            if (card) {
                const li = card.closest('li');
                if (li && !li.closest('app-broadcasts-carousel')) {
                    li.style.display = 'none';
                }
            }
        });
    });

    // Also hide notifications
    hideNotifications();
}

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

    setupCarouselDirectionTracking();

    const entries = carousel.querySelectorAll('.list__entry');
    const now = Date.now();

    entries.forEach(entry => {
        const isActive = entry.querySelector('button.entry__button[disabled]') !== null;

        if (isActive) {
            const usernameEl = entry.querySelector('h5.username') ||
                entry.querySelector('.toolbar .username span');

            if (usernameEl) {
                const username = usernameEl.textContent.trim();
                // Check if username matches any hidden user (respecting per-broadcaster exceptions)
                const isHidden = hiddenUserIds.some(odiskd => {
                    // Check if current user is an exception for this hidden broadcaster
                    const exceptions = hiddenExceptions[odiskd] || {};
                    if (currentUserId && exceptions[currentUserId]) {
                        return false; // Not hidden for this user
                    }

                    const userData = hiddenUsers[odiskd] || {};
                    return userData.username && userData.username.toLowerCase() === username.toLowerCase();
                });

                if (isHidden) {
                    if (now - lastSkipTime > SKIP_COOLDOWN) {
                        lastSkipTime = now;

                        const btnClass = lastDirection === 'prev' ? '.button--prev' : '.button--next';
                        const skipBtn = carousel.querySelector(btnClass);

                        if (skipBtn) {
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

// ============ Individual Volume Sliders ============

// Store volume states per video (keyed by username in toolbar)
// Load from localStorage or initialize empty
const guestVolumeStates = new Map(JSON.parse(localStorage.getItem('betternow-guest-volumes') || '[]'));

function saveGuestVolumes() {
    localStorage.setItem('betternow-guest-volumes', JSON.stringify([...guestVolumeStates]));
}

function getGuestUsername(tile) {
    const usernameEl = tile.querySelector('.username span');
    return usernameEl ? usernameEl.textContent.trim() : null;
}

// Create global volume slider for all guests
function createGlobalVolumeSlider() {
    // Find the top toolbar (above the stream with viewer count)
    const topToolbar = document.querySelector('app-top-toolbar .toolbar__right');
    if (!topToolbar) return;

    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');
    const hasGuests = videoTiles.length > 0;

    // Find main broadcaster video
    const broadcasterVideo = document.querySelector('.video-player video');

    // Remove slider if no broadcaster video
    if (!broadcasterVideo) {
        const existingSlider = document.querySelector('.betternow-global-volume');
        if (existingSlider) existingSlider.remove();
        const existingLabel = document.querySelector('.betternow-volume-label');
        if (existingLabel) existingLabel.remove();
        return;
    }

    // Check if already exists
    let volumeContainer = topToolbar.querySelector('.betternow-global-volume');
    const alreadyExists = !!volumeContainer;

    if (!alreadyExists) {
        // Create new slider
        volumeContainer = document.createElement('div');
        volumeContainer.className = 'betternow-global-volume toolbar__entry';
        volumeContainer.style.cssText = 'position: relative; display: flex; align-items: center;';

        // Create label (plain text, positioned above on hover)
        const label = document.createElement('span');
        label.className = 'betternow-volume-label';
        label.textContent = 'Stream Volume';
        label.style.cssText = 'position: fixed; font-size: 0.75rem; font-weight: 500; color: var(--color-text, #fff); white-space: nowrap; pointer-events: none; z-index: 9999; display: none;';

        const volumeContent = document.createElement('div');
        volumeContent.className = 'volume toolbar__content';
        volumeContent.style.cssText = 'display: flex; align-items: center; gap: 0; padding: 4px 0 4px 8px;';

        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'volume__range';
        sliderContainer.style.cssText = 'margin-right: 4px;';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.className = 'slider';
        slider.style.width = '60px';

        const volumeBtn = document.createElement('button');
        volumeBtn.className = 'volume__icon only-icon';
        volumeBtn.style.cssText = 'background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center;';

        const volumeIcon = document.createElement('i');
        volumeBtn.appendChild(volumeIcon);

        sliderContainer.appendChild(slider);
        volumeContent.appendChild(sliderContainer);
        volumeContent.appendChild(volumeBtn);
        document.body.appendChild(label);
        volumeContainer.appendChild(volumeContent);

        topToolbar.insertBefore(volumeContainer, topToolbar.firstChild);

        // Show label only on hover, positioned above
        volumeContent.addEventListener('mouseenter', () => {
            const rect = volumeContent.getBoundingClientRect();
            label.style.left = (rect.left + rect.width / 2) + 'px';
            label.style.top = (rect.top - 20) + 'px';
            label.style.transform = 'translateX(-50%)';
            label.style.display = '';
        });

        volumeContent.addEventListener('mouseleave', () => {
            label.style.display = 'none';
        });
    }

    const slider = volumeContainer.querySelector('.slider');
    const volumeIcon = volumeContainer.querySelector('.volume__icon i');
    const volumeBtn = volumeContainer.querySelector('.volume__icon');

    // Update mode based on whether there are guests
    const currentMode = volumeContainer.dataset.mode;
    const newMode = hasGuests ? 'multiplier' : 'broadcaster';

    if (currentMode !== newMode) {
        volumeContainer.dataset.mode = newMode;

        // Remove old event listeners by cloning
        const newSlider = slider.cloneNode(true);
        slider.parentNode.replaceChild(newSlider, slider);
        const newVolumeBtn = volumeBtn.cloneNode(true);
        volumeBtn.parentNode.replaceChild(newVolumeBtn, volumeBtn);

        const freshSlider = volumeContainer.querySelector('.slider');
        const freshVolumeBtn = volumeContainer.querySelector('.volume__icon');
        const freshVolumeIcon = freshVolumeBtn.querySelector('i');

        if (newMode === 'broadcaster') {
            // Mirror broadcaster mode
            freshVolumeBtn.title = 'Broadcaster Volume';

            // Set initial value from broadcaster
            const currentVol = Math.round(broadcasterVideo.volume * 100);
            freshSlider.value = currentVol.toString();
            updateVolumeIcon(freshVolumeIcon, currentVol.toString());

            freshSlider.addEventListener('input', () => {
                const vol = parseInt(freshSlider.value);
                broadcasterVideo.volume = vol / 100;
                broadcasterVideo.muted = vol === 0;
                updateVolumeIcon(freshVolumeIcon, freshSlider.value);
            });

            freshVolumeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (broadcasterVideo.muted || broadcasterVideo.volume === 0) {
                    broadcasterVideo.muted = false;
                    broadcasterVideo.volume = 0.5;
                    freshSlider.value = '50';
                } else {
                    broadcasterVideo.muted = true;
                    freshSlider.value = '0';
                }
                updateVolumeIcon(freshVolumeIcon, freshSlider.value);
            });
        } else {
            // Multiplier mode for guests
            freshVolumeBtn.title = 'Global Guest Volume';

            let globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');
            let lastNonZeroMultiplier = parseInt(localStorage.getItem('betternow-global-guest-last-multiplier') || '100');

            freshSlider.value = globalMultiplier.toString();
            updateVolumeIcon(freshVolumeIcon, globalMultiplier.toString());

            freshSlider.addEventListener('input', () => {
                globalMultiplier = parseInt(freshSlider.value);
                if (globalMultiplier > 0) {
                    lastNonZeroMultiplier = globalMultiplier;
                    localStorage.setItem('betternow-global-guest-last-multiplier', lastNonZeroMultiplier.toString());
                }
                localStorage.setItem('betternow-global-guest-multiplier', globalMultiplier.toString());
                updateVolumeIcon(freshVolumeIcon, freshSlider.value);
                applyGlobalMultiplier(globalMultiplier);
            });

            freshVolumeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (globalMultiplier === 0) {
                    globalMultiplier = lastNonZeroMultiplier;
                    freshSlider.value = globalMultiplier.toString();
                } else {
                    lastNonZeroMultiplier = globalMultiplier;
                    localStorage.setItem('betternow-global-guest-last-multiplier', lastNonZeroMultiplier.toString());
                    globalMultiplier = 0;
                    freshSlider.value = '0';
                }
                localStorage.setItem('betternow-global-guest-multiplier', globalMultiplier.toString());
                updateVolumeIcon(freshVolumeIcon, freshSlider.value);
                applyGlobalMultiplier(globalMultiplier);
            });

            // Apply initial multiplier
            applyGlobalMultiplier(globalMultiplier);
        }
    }

    // In broadcaster mode, sync with broadcaster video periodically
    if (volumeContainer.dataset.mode === 'broadcaster') {
        const currentVol = broadcasterVideo.muted ? 0 : Math.round(broadcasterVideo.volume * 100);
        const sliderVol = parseInt(volumeContainer.querySelector('.slider').value);
        if (currentVol !== sliderVol) {
            volumeContainer.querySelector('.slider').value = currentVol.toString();
            updateVolumeIcon(volumeContainer.querySelector('.volume__icon i'), currentVol.toString());
        }
    }
}

function applyGlobalMultiplier(multiplier) {
    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');

    videoTiles.forEach(tile => {
        const videoEl = tile.querySelector('video');
        const username = getGuestUsername(tile);

        if (!videoEl || !username) return;

        // Get the individual saved volume (base volume)
        const baseVolume = guestVolumeStates.has(username) ? guestVolumeStates.get(username) : 100;

        // Apply multiplier to base volume
        const effectiveVolume = (baseVolume * multiplier) / 100;

        videoEl.volume = effectiveVolume / 100;
        videoEl.muted = effectiveVolume === 0;
    });
}

// Apply saved volumes to videos as early as possible
function applyEarlyVolumes() {
    const globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');
    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');

    videoTiles.forEach(tile => {
        const username = getGuestUsername(tile);
        const videoEl = tile.querySelector('video');

        if (!videoEl || videoEl.dataset.volumeApplied) return;

        // Get base volume (individual setting or default 100)
        const baseVolume = (username && guestVolumeStates.has(username))
            ? guestVolumeStates.get(username)
            : 100;

        // Apply multiplier
        const effectiveVolume = (baseVolume * globalMultiplier) / 100;

        videoEl.volume = effectiveVolume / 100;
        videoEl.muted = effectiveVolume === 0;
        videoEl.dataset.volumeApplied = 'true';
    });
}

// Watch for video elements being added and apply volumes immediately
const earlyVolumeObserver = new MutationObserver(() => {
    applyEarlyVolumes();
});

// Start observing as soon as possible
if (document.body) {
    earlyVolumeObserver.observe(document.body, { childList: true, subtree: true });
} else {
    document.addEventListener('DOMContentLoaded', () => {
        earlyVolumeObserver.observe(document.body, { childList: true, subtree: true });
    });
}

// Also run immediately and frequently at startup
applyEarlyVolumes();
setTimeout(applyEarlyVolumes, 100);
setTimeout(applyEarlyVolumes, 250);
setTimeout(applyEarlyVolumes, 500);

function createVolumeSliders() {
    // Find all video tiles (not the main broadcaster)
    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');

    videoTiles.forEach(tile => {
        // Skip if already has volume slider
        if (tile.querySelector('.betternow-volume-slider')) return;

        // Find the video element
        const videoEl = tile.querySelector('video');
        if (!videoEl) return;

        // Find the toolbar overlay bottom (where the volume icon should go)
        const toolbarBottom = tile.querySelector('.video-overlay-bottom .toolbar__right');
        if (!toolbarBottom) return;

        // Get username for this tile to track volume state
        const username = getGuestUsername(tile);

        // Get global multiplier
        const globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');

        // Restore saved base volume or default to 100
        let baseVolume = 100;
        if (username && guestVolumeStates.has(username)) {
            baseVolume = guestVolumeStates.get(username);
        }

        // Apply multiplier for actual video volume
        const effectiveVolume = (baseVolume * globalMultiplier) / 100;
        videoEl.volume = effectiveVolume / 100;
        videoEl.muted = effectiveVolume === 0;

        // Create volume container matching YouNow's structure
        const volumeContainer = document.createElement('div');
        volumeContainer.className = 'betternow-volume-slider toolbar__entry';
        volumeContainer.style.display = 'none'; // Hidden by default

        const volumeContent = document.createElement('div');
        volumeContent.className = 'volume toolbar__content';
        volumeContent.style.cssText = 'display: flex; align-items: center;';

        // Create slider container (hidden by default, show on hover over icon)
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'volume__range';
        sliderContainer.style.cssText = 'display: none; margin-right: 8px;';

        // Create slider matching YouNow's
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '100';
        slider.value = baseVolume.toString();
        slider.className = 'slider';

        // Create volume button
        const volumeBtn = document.createElement('button');
        volumeBtn.className = 'volume__icon only-icon';
        volumeBtn.style.cssText = 'background: none; border: none; cursor: pointer; padding: 0;';

        // Create volume icon
        const volumeIcon = document.createElement('i');
        volumeIcon.className = 'ynicon ynicon-mute';

        // Update video volume when slider changes
        slider.addEventListener('input', () => {
            const baseVolume = parseInt(slider.value);
            const globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');
            const effectiveVolume = (baseVolume * globalMultiplier) / 100;

            videoEl.volume = effectiveVolume / 100;
            videoEl.muted = effectiveVolume === 0;
            updateVolumeIcon(volumeIcon, slider.value);

            // Save base volume state
            const currentUsername = getGuestUsername(tile);
            if (currentUsername) {
                guestVolumeStates.set(currentUsername, baseVolume);
                saveGuestVolumes();
            }
        });

        // Toggle mute on icon click
        volumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');

            if (videoEl.muted || videoEl.volume === 0) {
                const baseVolume = 50;
                const effectiveVolume = (baseVolume * globalMultiplier) / 100;
                videoEl.muted = false;
                videoEl.volume = effectiveVolume / 100;
                slider.value = '50';
            } else {
                videoEl.muted = true;
                videoEl.volume = 0;
                slider.value = '0';
            }
            updateVolumeIcon(volumeIcon, slider.value);

            // Save base volume state
            const currentUsername = getGuestUsername(tile);
            if (currentUsername) {
                guestVolumeStates.set(currentUsername, parseInt(slider.value));
                saveGuestVolumes();
            }
        });

        // Show slider on hover over the volume control
        volumeContent.addEventListener('mouseenter', () => {
            sliderContainer.style.display = 'block';
        });

        volumeContent.addEventListener('mouseleave', () => {
            sliderContainer.style.display = 'none';
        });

        // Prevent clicks from propagating to video tile
        volumeContainer.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        sliderContainer.appendChild(slider);
        volumeBtn.appendChild(volumeIcon);
        volumeContent.appendChild(sliderContainer);
        volumeContent.appendChild(volumeBtn);
        volumeContainer.appendChild(volumeContent);
        toolbarBottom.appendChild(volumeContainer);

        // Set initial icon state
        updateVolumeIcon(volumeIcon, videoEl.muted ? '0' : (videoEl.volume * 100).toString());
    });
}

// Update volume slider visibility based on tile selection
function updateVolumeSliderVisibility() {
    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');

    videoTiles.forEach(tile => {
        const volumeSlider = tile.querySelector('.betternow-volume-slider');
        if (!volumeSlider) return;

        const toolbarContainer = tile.querySelector('.toolbar--overlay-container');
        if (toolbarContainer && toolbarContainer.classList.contains('is-main')) {
            volumeSlider.style.display = '';
        } else {
            volumeSlider.style.display = 'none';
        }
    });
}

function updateVolumeIcon(icon, value) {
    const vol = parseInt(value);
    if (vol === 0) {
        icon.className = 'ynicon ynicon-mute-sel';
    } else {
        icon.className = 'ynicon ynicon-mute';
    }
}

// Run volume slider creation and visibility check periodically
setInterval(() => {
    createVolumeSliders();
    updateVolumeSliderVisibility();
}, 1000);

// Watch for selection changes and reapply volumes immediately
function setupVolumeObserver() {
    const fullscreenWrapper = document.querySelector('.fullscreen-wrapper');
    if (!fullscreenWrapper || fullscreenWrapper.dataset.volumeObserver) return;

    fullscreenWrapper.dataset.volumeObserver = 'true';

    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList.contains('toolbar--overlay-container')) {
                    // Selection changed - reapply volumes to ALL tiles and update visibility
                    reapplyAllGuestVolumes();
                    updateVolumeSliderVisibility();
                }
            }
        });
    });

    observer.observe(fullscreenWrapper, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true
    });
}

function reapplyAllGuestVolumes() {
    const globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');
    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');

    videoTiles.forEach(tile => {
        const username = getGuestUsername(tile);
        const videoEl = tile.querySelector('video');
        const slider = tile.querySelector('.betternow-volume-slider .slider');
        const volumeIcon = tile.querySelector('.betternow-volume-slider .volume__icon i');

        if (!videoEl) return;

        // Get base volume
        const baseVolume = (username && guestVolumeStates.has(username))
            ? guestVolumeStates.get(username)
            : 100;

        // Apply multiplier for actual video volume
        const effectiveVolume = (baseVolume * globalMultiplier) / 100;

        videoEl.volume = effectiveVolume / 100;
        videoEl.muted = effectiveVolume === 0;

        // Individual slider shows base volume (not multiplied)
        if (slider) slider.value = baseVolume.toString();
        if (volumeIcon) updateVolumeIcon(volumeIcon, baseVolume.toString());
    });
}

// Setup observer and global volume slider periodically until active
setInterval(() => {
    setupVolumeObserver();
    createGlobalVolumeSlider();
}, 1000);