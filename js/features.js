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

    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'auto-chest-controls';
    controlsDiv.className = 'toolbar__entry';
    controlsDiv.innerHTML = `
        <div class="toolbar__content" style="display: flex; align-items: center; gap: 8px;">
            <button id="auto-chest-toggle" title="Auto Chest Drop" style="
                background: ${autoChestEnabled ? '#22c55e' : '#444'};
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                color: white;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
            ">
                <span>🎁</span>
                <span>Auto Chest</span>
            </button>
            <div id="chest-threshold-controls" style="display: ${autoChestEnabled ? 'flex' : 'none'}; align-items: center; gap: 8px;">
                <input id="chest-threshold-input" type="number" value="${autoChestThreshold || ''}" placeholder="likes" style="
                    width: 60px;
                    background: #333;
                    border: 1px solid #555;
                    border-radius: 4px;
                    padding: 4px;
                    color: white;
                    font-size: 12px;
                    text-align: center;
                " title="Threshold (likes)" />
                <button id="chest-threshold-update" style="
                    background: #3b82f6;
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                    color: white;
                    font-size: 12px;
                    cursor: pointer;
                ">Update</button>
                <span id="chest-update-status" style="
                    color: #22c55e;
                    font-size: 11px;
                    width: 50px;
                    text-align: left;
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
        toggleBtn.style.background = autoChestEnabled ? '#22c55e' : '#444';
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

    updateBtn.addEventListener('click', () => {
        const value = parseInt(thresholdInput.value);
        if (!isNaN(value) && value > 0) {
            autoChestThreshold = value;
            saveChestSettingsLocal();

            // Show status
            updateStatus.textContent = 'Updated!';
            setTimeout(() => {
                updateStatus.textContent = '';
            }, 1500);
        } else {
            // Show error
            updateStatus.style.color = '#ef4444';
            updateStatus.textContent = 'Invalid';
            setTimeout(() => {
                updateStatus.textContent = '';
                updateStatus.style.color = '#22c55e';
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

// ============ Carousel / Hidden Broadcasters ============

function hideBroadcasters() {
    hiddenUserIds.forEach(odiskd => {
        const userData = hiddenUsers[odiskd] || {};
        const username = userData.username;
        if (!username) return;

        document.querySelectorAll(`a[href="/${username}"]`).forEach(el => {
            const card = el.closest('li');
            if (card && !card.closest('app-broadcasts-carousel')) {
                card.style.display = 'none';
            }
        });
    });
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
                // Check if username matches any hidden user
                const isHidden = hiddenUserIds.some(odiskd => {
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