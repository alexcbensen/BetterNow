// ============ Volume Controls ============
// Individual guest volume sliders and global volume multiplier

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
    // Ensure BetterNow toolbar exists
    const betterNowToolbar = createBetterNowToolbar();
    if (!betterNowToolbar) return;
    
    const rightSection = betterNowToolbar.querySelector('.betternow-toolbar__right');
    if (!rightSection) return;

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
    let volumeContainer = rightSection.querySelector('.betternow-global-volume');
    const alreadyExists = !!volumeContainer;

    if (!alreadyExists) {
        // Create new slider
        volumeContainer = document.createElement('div');
        volumeContainer.className = 'betternow-global-volume';
        volumeContainer.style.cssText = 'position: relative; display: flex; align-items: center;';

        // Create label (plain text, positioned above on hover)
        const label = document.createElement('span');
        label.className = 'betternow-volume-label';
        label.textContent = 'Stream Volume';
        label.style.cssText = 'position: fixed; font-size: 0.75rem; font-weight: 500; color: var(--color-text, #fff); white-space: nowrap; pointer-events: none; z-index: 9999; display: none;';

        const volumeContent = document.createElement('div');
        volumeContent.className = 'volume toolbar__content';
        volumeContent.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'volume__range';

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

        rightSection.appendChild(volumeContainer);

        // Show label only on hover, positioned above the slider
        volumeContent.addEventListener('mouseenter', () => {
            const sliderRect = sliderContainer.getBoundingClientRect();
            label.style.left = (sliderRect.left + sliderRect.width / 2) + 'px';
            label.style.top = (sliderRect.top - 20) + 'px';
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
        console.log('[BetterNow] Volume slider mode switching:', currentMode, '→', newMode);
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
    // Protect against NaN or invalid values
    if (isNaN(multiplier) || multiplier < 0) {
        console.warn('[BetterNow] applyGlobalMultiplier: Invalid multiplier value, defaulting to 100. Received:', multiplier);
        multiplier = 100;
    }
    
    console.log('[BetterNow] applyGlobalMultiplier called with:', multiplier);
    
    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');

    videoTiles.forEach(tile => {
        const videoElements = tile.querySelectorAll('video');
        const username = getGuestUsername(tile);

        if (videoElements.length === 0 || !username) return;

        // Get the individual saved volume (base volume)
        const baseVolume = guestVolumeStates.has(username) ? guestVolumeStates.get(username) : 100;

        // Apply multiplier to base volume
        const effectiveVolume = (baseVolume * multiplier) / 100;

        // Apply to ALL videos in this tile
        videoElements.forEach(v => {
            v.volume = effectiveVolume / 100;
            v.muted = effectiveVolume === 0;
        });
        
        if (effectiveVolume === 0) {
            console.log('[BetterNow] Muted guest:', username, '(baseVolume:', baseVolume, ', multiplier:', multiplier, ')');
        }
    });
}

// Apply saved volumes to videos as early as possible
function applyEarlyVolumes() {
    let globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');
    // Protect against NaN or invalid values
    if (isNaN(globalMultiplier) || globalMultiplier < 0) {
        console.warn('[BetterNow] applyEarlyVolumes: Invalid globalMultiplier, defaulting to 100. Received:', globalMultiplier);
        globalMultiplier = 100;
    }
    
    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');

    videoTiles.forEach(tile => {
        const username = getGuestUsername(tile);
        // Get ALL video elements in this tile
        const videoElements = tile.querySelectorAll('video');

        if (videoElements.length === 0) return;
        
        // Get base volume (individual setting or default 100)
        const baseVolume = (username && guestVolumeStates.has(username))
            ? guestVolumeStates.get(username)
            : 100;

        // Apply multiplier
        const effectiveVolume = (baseVolume * globalMultiplier) / 100;

        // Apply to each video that hasn't been processed yet
        videoElements.forEach(v => {
            // Skip if this specific video already has volume applied
            if (v.dataset.volumeApplied) return;
            
            // Skip the user's own tile (shows "You") to prevent echo
            if (username === 'You') {
                v.muted = true;
                v.dataset.volumeApplied = 'true';
                return;
            }

            v.volume = effectiveVolume / 100;
            v.muted = effectiveVolume === 0;
            v.dataset.volumeApplied = 'true';
        });
    });
}

// Watch for video elements being added and apply volumes immediately
let earlyVolumeTimeout = null;
const earlyVolumeObserver = new MutationObserver(() => {
    // Debounce to avoid excessive calls
    clearTimeout(earlyVolumeTimeout);
    earlyVolumeTimeout = setTimeout(applyEarlyVolumes, 50);
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

        // Find ALL video elements in this tile (there can be multiple with screenshare)
        const videoElements = tile.querySelectorAll('video');
        if (videoElements.length === 0) return;

        // Get username for this tile to track volume state
        const username = getGuestUsername(tile);
        
        // Skip the user's own tile (shows "You") to prevent echo
        if (username === 'You') {
            // Keep own audio muted on all videos
            videoElements.forEach(v => v.muted = true);
            return;
        }

        // Find the toolbar overlay bottom (where the volume icon should go)
        const toolbarBottom = tile.querySelector('.video-overlay-bottom .toolbar__right');
        if (!toolbarBottom) return;

        // Get global multiplier
        let globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');
        // Protect against NaN or invalid values
        if (isNaN(globalMultiplier) || globalMultiplier < 0) globalMultiplier = 100;

        // Restore saved base volume or default to 100
        let baseVolume = 100;
        if (username && guestVolumeStates.has(username)) {
            baseVolume = guestVolumeStates.get(username);
        }

        // Apply multiplier for actual video volume to ALL videos in this tile
        const effectiveVolume = (baseVolume * globalMultiplier) / 100;
        videoElements.forEach(videoEl => {
            videoEl.volume = effectiveVolume / 100;
            videoEl.muted = effectiveVolume === 0;
        });

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

        // Update video volume when slider changes - apply to ALL videos in tile
        slider.addEventListener('input', () => {
            const baseVolume = parseInt(slider.value) || 0;
            let globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');
            if (isNaN(globalMultiplier) || globalMultiplier < 0) globalMultiplier = 100;
            const effectiveVolume = (baseVolume * globalMultiplier) / 100;

            // Apply to all videos in this tile
            tile.querySelectorAll('video').forEach(v => {
                v.volume = effectiveVolume / 100;
                v.muted = effectiveVolume === 0;
            });
            updateVolumeIcon(volumeIcon, slider.value);

            // Save base volume state
            const currentUsername = getGuestUsername(tile);
            if (currentUsername) {
                guestVolumeStates.set(currentUsername, baseVolume);
                saveGuestVolumes();
            }
        });

        // Toggle mute on icon click - apply to ALL videos in tile
        volumeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            let globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');
            if (isNaN(globalMultiplier) || globalMultiplier < 0) globalMultiplier = 100;
            const videos = tile.querySelectorAll('video');
            const firstVideo = videos[0];

            if (firstVideo && (firstVideo.muted || firstVideo.volume === 0)) {
                const baseVolume = 50;
                const effectiveVolume = (baseVolume * globalMultiplier) / 100;
                videos.forEach(v => {
                    v.muted = false;
                    v.volume = effectiveVolume / 100;
                });
                slider.value = '50';
            } else {
                videos.forEach(v => {
                    v.muted = true;
                    v.volume = 0;
                });
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

        // Set initial icon state (use first video as reference)
        const firstVideo = videoElements[0];
        updateVolumeIcon(volumeIcon, firstVideo.muted ? '0' : (firstVideo.volume * 100).toString());
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
    let globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');
    // Protect against NaN or invalid values
    if (isNaN(globalMultiplier) || globalMultiplier < 0) {
        console.warn('[BetterNow] reapplyAllGuestVolumes: Invalid globalMultiplier, defaulting to 100. Received:', globalMultiplier);
        globalMultiplier = 100;
    }
    
    console.log('[BetterNow] reapplyAllGuestVolumes called with multiplier:', globalMultiplier);
    
    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');

    videoTiles.forEach(tile => {
        const username = getGuestUsername(tile);
        const videoElements = tile.querySelectorAll('video');
        const slider = tile.querySelector('.betternow-volume-slider .slider');
        const volumeIcon = tile.querySelector('.betternow-volume-slider .volume__icon i');

        if (videoElements.length === 0) return;
        
        // Skip if username not loaded yet
        if (!username) return;
        
        // Skip the user's own tile (shows "You") to prevent echo
        if (username === 'You') {
            videoElements.forEach(v => v.muted = true);
            return;
        }

        // Get base volume
        const baseVolume = guestVolumeStates.has(username)
            ? guestVolumeStates.get(username)
            : 100;

        // Apply multiplier for actual video volume to ALL videos in tile
        const effectiveVolume = (baseVolume * globalMultiplier) / 100;

        videoElements.forEach(v => {
            v.volume = effectiveVolume / 100;
            v.muted = effectiveVolume === 0;
        });

        // Individual slider shows base volume (not multiplied)
        if (slider) slider.value = baseVolume.toString();
        if (volumeIcon) updateVolumeIcon(volumeIcon, baseVolume.toString());
    });
}

// Initialize volume controls when DOM changes (instead of polling every second)
function initVolumeControls() {
    setupVolumeObserver();
    createVolumeSliders();
    updateVolumeSliderVisibility();
    createGlobalVolumeSlider();
}

// Observer to detect when video player or toolbar appears
const volumeControlsObserver = new MutationObserver((mutations) => {
    let shouldInit = false;
    
    for (const mutation of mutations) {
        // Check for added nodes that might be video tiles or toolbar
        if (mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if it's a video tile, toolbar, or contains them
                    if (node.matches?.('.video, .fullscreen-wrapper, .toolbar, app-channel') ||
                        node.querySelector?.('.video, .fullscreen-wrapper, .toolbar')) {
                        shouldInit = true;
                        break;
                    }
                }
            }
        }
        if (shouldInit) break;
    }
    
    if (shouldInit) {
        // Debounce to avoid multiple rapid calls
        clearTimeout(volumeControlsObserver.timeout);
        volumeControlsObserver.timeout = setTimeout(initVolumeControls, 100);
    }
});

// Start observing
if (document.body) {
    volumeControlsObserver.observe(document.body, { childList: true, subtree: true });
} else {
    document.addEventListener('DOMContentLoaded', () => {
        volumeControlsObserver.observe(document.body, { childList: true, subtree: true });
    });
}

// Also run on initial load and navigation
initVolumeControls();
document.addEventListener('DOMContentLoaded', initVolumeControls);
window.addEventListener('popstate', initVolumeControls); // Handle back/forward navigation
