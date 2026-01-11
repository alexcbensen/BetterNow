// ============ Volume Controls ============
// Individual guest volume sliders and global volume multiplier

// Debug logging - set to true for verbose output
const VOLUME_DEBUG = false;

// Timeout for checking if page is a live stream (ms)
const LIVE_STREAM_CHECK_TIMEOUT = 1000;

function volumeLog(...args) {
    if (VOLUME_DEBUG) {
        console.log('[BetterNow Volume]', new Date().toISOString().substr(11, 12), ...args);
    }
}

function volumeWarn(...args) {
    // Warnings are always shown - for unexpected but recoverable situations
    console.warn('[BetterNow Volume]', ...args);
}

function volumeError(...args) {
    // Errors are always shown - for things that shouldn't happen
    console.error('[BetterNow Volume]', ...args);
}

// Check if current page is a live stream
// Requires multiple conditions to prevent false positives during navigation
function isLiveStream() {
    const hasAppChannel = document.querySelector('app-channel') !== null;
    const hasOnlineClass = document.querySelector('.broadcaster-is-online') !== null;
    const hasFullscreenWrapper = document.querySelector('.fullscreen-wrapper') !== null;
    const hasVideoTiles = document.querySelectorAll('.fullscreen-wrapper > .video').length > 0;
    
    return hasAppChannel && hasOnlineClass && hasFullscreenWrapper && hasVideoTiles;
}

// Store volume states per video (keyed by username in toolbar)
// Load from localStorage or initialize empty
let guestVolumeStates;
try {
    guestVolumeStates = new Map(JSON.parse(localStorage.getItem('betternow-guest-volumes') || '[]'));
} catch (e) {
    volumeError('Failed to load guest volume states from localStorage:', e);
    guestVolumeStates = new Map();
}

function saveGuestVolumes() {
    try {
        localStorage.setItem('betternow-guest-volumes', JSON.stringify([...guestVolumeStates]));
        volumeLog('Saved guest volumes:', Object.fromEntries(guestVolumeStates));
    } catch (e) {
        volumeError('Failed to save guest volumes:', e);
    }
}

function getGuestUsername(tile) {
    const usernameEl = tile.querySelector('.username span');
    const username = usernameEl ? usernameEl.textContent.trim() : null;
    return username;
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
        volumeLog('Mode switching:', currentMode, '→', newMode);
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
            volumeLog('Broadcaster mode: Initial volume:', currentVol);

            freshSlider.addEventListener('input', () => {
                const vol = parseInt(freshSlider.value);
                const oldVol = broadcasterVideo.volume;
                broadcasterVideo.volume = vol / 100;
                broadcasterVideo.muted = vol === 0;
                updateVolumeIcon(freshVolumeIcon, freshSlider.value);
                volumeLog('Broadcaster slider changed:', oldVol.toFixed(2), '→', (vol / 100).toFixed(2), '| muted:', broadcasterVideo.muted);
            });

            freshVolumeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const wasMuted = broadcasterVideo.muted || broadcasterVideo.volume === 0;
                if (wasMuted) {
                    broadcasterVideo.muted = false;
                    broadcasterVideo.volume = 0.5;
                    freshSlider.value = '50';
                    volumeLog('Broadcaster unmuted: volume → 0.50');
                } else {
                    broadcasterVideo.muted = true;
                    freshSlider.value = '0';
                    volumeLog('Broadcaster muted');
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
            volumeLog('Multiplier mode: Initial multiplier:', globalMultiplier, '| lastNonZero:', lastNonZeroMultiplier);

            freshSlider.addEventListener('input', () => {
                const oldMultiplier = globalMultiplier;
                globalMultiplier = parseInt(freshSlider.value);
                volumeLog('Global multiplier slider changed:', oldMultiplier, '→', globalMultiplier);
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
                const oldMultiplier = globalMultiplier;
                if (globalMultiplier === 0) {
                    globalMultiplier = lastNonZeroMultiplier;
                    freshSlider.value = globalMultiplier.toString();
                    volumeLog('Global multiplier unmuted:', oldMultiplier, '→', globalMultiplier);
                } else {
                    lastNonZeroMultiplier = globalMultiplier;
                    localStorage.setItem('betternow-global-guest-last-multiplier', lastNonZeroMultiplier.toString());
                    globalMultiplier = 0;
                    freshSlider.value = '0';
                    volumeLog('Global multiplier muted:', oldMultiplier, '→ 0');
                }
                localStorage.setItem('betternow-global-guest-multiplier', globalMultiplier.toString());
                updateVolumeIcon(freshVolumeIcon, freshSlider.value);
                applyGlobalMultiplier(globalMultiplier);
            });

            // Apply initial multiplier
            volumeLog('Applying initial multiplier:', globalMultiplier);
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
    volumeLog('applyGlobalMultiplier() called with:', multiplier);
    
    // Protect against NaN or invalid values
    if (isNaN(multiplier) || multiplier < 0) {
        volumeWarn('applyGlobalMultiplier: Invalid multiplier value, defaulting to 100. Received:', multiplier);
        multiplier = 100;
    }
    
    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');

    videoTiles.forEach((tile, index) => {
        const videoElements = tile.querySelectorAll('video');
        const username = getGuestUsername(tile);

        if (videoElements.length === 0 || !username) return;

        // Get the individual saved volume (base volume)
        const baseVolume = guestVolumeStates.has(username) ? guestVolumeStates.get(username) : 100;

        // Apply multiplier to base volume
        const effectiveVolume = (baseVolume * multiplier) / 100;

        volumeLog('applyGlobalMultiplier: Tile', index, '- User:', username, '| baseVolume:', baseVolume, '| effectiveVolume:', effectiveVolume);

        // Apply to ALL videos in this tile
        videoElements.forEach((v, vIndex) => {
            v.volume = effectiveVolume / 100;
            v.muted = effectiveVolume === 0;
        });
    });
}

// Apply saved volumes to videos as early as possible
function applyEarlyVolumes() {
    // Skip if volume sliders already created (initVolumeControls already ran)
    if (document.querySelector('.betternow-volume-slider')) return;
    
    let globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');
    if (isNaN(globalMultiplier) || globalMultiplier < 0) globalMultiplier = 100;
    
    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');
    if (videoTiles.length === 0) return;

    let appliedCount = 0;
    videoTiles.forEach((tile) => {
        const username = getGuestUsername(tile);
        const videoElements = tile.querySelectorAll('video');
        if (videoElements.length === 0) return;
        
        const baseVolume = (username && guestVolumeStates.has(username)) ? guestVolumeStates.get(username) : 100;
        const effectiveVolume = (baseVolume * globalMultiplier) / 100;

        videoElements.forEach((v) => {
            if (v.dataset.volumeApplied) return;
            
            if (username === 'You') {
                v.muted = true;
            } else {
                v.volume = effectiveVolume / 100;
                v.muted = effectiveVolume === 0;
                appliedCount++;
            }
            v.dataset.volumeApplied = 'true';
        });
    });
    
    if (appliedCount > 0) {
        volumeLog('applyEarlyVolumes: Applied volume to', appliedCount, 'videos');
    }
}

// Watch for guest join/leave - observe fullscreen-wrapper for video tile changes
let guestChangeObserver = null;
let lastGuestUsernames = new Set();

function getCurrentGuestUsernames() {
    const usernames = new Set();
    document.querySelectorAll('.fullscreen-wrapper > .video').forEach(tile => {
        const username = getGuestUsername(tile);
        if (username && username !== 'You') {
            usernames.add(username);
        }
    });
    return usernames;
}

function setsAreEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const item of a) {
        if (!b.has(item)) return false;
    }
    return true;
}

function setupGuestChangeObserver() {
    const fullscreenWrapper = document.querySelector('.fullscreen-wrapper');
    if (!fullscreenWrapper) return;
    
    // Disconnect existing observer if any
    if (guestChangeObserver) {
        guestChangeObserver.disconnect();
        guestChangeObserver = null;
    }
    
    volumeLog('setupGuestChangeObserver: Setting up observer on fullscreen-wrapper');
    
    guestChangeObserver = new MutationObserver((mutations) => {
        // Check if video tiles were added or removed
        let videoTileChanged = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                // Check added nodes for video tiles
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('video')) {
                        videoTileChanged = true;
                        break;
                    }
                }
                // Check removed nodes for video tiles
                for (const node of mutation.removedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('video')) {
                        videoTileChanged = true;
                        break;
                    }
                }
            }
            if (videoTileChanged) break;
        }
        
        if (videoTileChanged) {
            // Check if the actual guest list changed (not just DOM reshuffling)
            const currentUsernames = getCurrentGuestUsernames();
            
            if (!setsAreEqual(currentUsernames, lastGuestUsernames)) {
                volumeLog('guestChangeObserver: Guest list changed:', 
                    [...lastGuestUsernames].join(', ') || '(none)', '→', 
                    [...currentUsernames].join(', ') || '(none)');
                lastGuestUsernames = currentUsernames;
                
                // Reapply volumes after a short delay to let DOM settle
                setTimeout(() => {
                    volumeLog('guestChangeObserver: Reapplying volumes after guest change');
                    reapplyAllGuestVolumes();
                    createVolumeSliders();
                    updateVolumeSliderVisibility();
                }, 100);
            }
        }
    });
    
    guestChangeObserver.observe(fullscreenWrapper, { childList: true });
    lastGuestUsernames = getCurrentGuestUsernames();
    volumeLog('setupGuestChangeObserver: Initial guests:', [...lastGuestUsernames].join(', ') || '(none)');
}

// Single early volume application at startup - observers handle the rest
volumeLog('Running early volume application at startup');
applyEarlyVolumes();

function createVolumeSliders() {
    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');
    if (videoTiles.length === 0) return;
    
    let createdCount = 0;
    videoTiles.forEach((tile, index) => {
        // Skip if already has volume slider
        if (tile.querySelector('.betternow-volume-slider')) return;

        const videoElements = tile.querySelectorAll('video');
        if (videoElements.length === 0) return;

        const username = getGuestUsername(tile);
        
        // Skip the user's own tile
        if (username === 'You') {
            videoElements.forEach(v => v.muted = true);
            return;
        }

        const toolbarBottom = tile.querySelector('.video-overlay-bottom .toolbar__right');
        if (!toolbarBottom) return;

        let globalMultiplier = parseInt(localStorage.getItem('betternow-global-guest-multiplier') || '100');
        if (isNaN(globalMultiplier) || globalMultiplier < 0) globalMultiplier = 100;

        let baseVolume = 100;
        if (username && guestVolumeStates.has(username)) {
            baseVolume = guestVolumeStates.get(username);
        }

        const effectiveVolume = (baseVolume * globalMultiplier) / 100;
        
        videoElements.forEach((videoEl) => {
            videoEl.volume = effectiveVolume / 100;
            videoEl.muted = effectiveVolume === 0;
        });
        
        createdCount++;

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
            const currentUsername = getGuestUsername(tile);

            volumeLog('Individual slider changed for', currentUsername, '| baseVolume:', baseVolume, '| globalMultiplier:', globalMultiplier, '| effectiveVolume:', effectiveVolume);

            // Apply to all videos in this tile
            tile.querySelectorAll('video').forEach((v, vIndex) => {
                const oldVol = v.volume;
                v.volume = effectiveVolume / 100;
                v.muted = effectiveVolume === 0;
                volumeLog('Individual slider: Video', vIndex, '- volume:', oldVol.toFixed(2), '→', v.volume.toFixed(2), '| muted:', v.muted);
            });
            updateVolumeIcon(volumeIcon, slider.value);

            // Save base volume state
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
            const currentUsername = getGuestUsername(tile);

            if (firstVideo && (firstVideo.muted || firstVideo.volume === 0)) {
                // Unmuting - restore previous volume or default to 100
                const savedVolume = currentUsername && guestVolumeStates.has(currentUsername) 
                    ? guestVolumeStates.get(currentUsername) 
                    : 100;
                // If saved volume was 0 (muted), restore to 100
                const baseVolume = savedVolume > 0 ? savedVolume : 100;
                const effectiveVolume = (baseVolume * globalMultiplier) / 100;
                volumeLog('Individual mute toggle: Unmuting', currentUsername, '| baseVolume:', baseVolume, '| effectiveVolume:', effectiveVolume);
                videos.forEach((v, vIndex) => {
                    v.muted = false;
                    v.volume = effectiveVolume / 100;
                    volumeLog('Individual unmute: Video', vIndex, '- volume → ', v.volume.toFixed(2));
                });
                slider.value = baseVolume.toString();
                
                // Save the restored volume
                if (currentUsername) {
                    guestVolumeStates.set(currentUsername, baseVolume);
                    saveGuestVolumes();
                }
            } else {
                // Muting - save current volume first, then mute
                const currentVolume = parseInt(slider.value) || 100;
                volumeLog('Individual mute toggle: Muting', currentUsername, '| saving volume:', currentVolume);
                
                // Save current volume before muting (so we can restore it)
                if (currentUsername && currentVolume > 0) {
                    guestVolumeStates.set(currentUsername, currentVolume);
                    saveGuestVolumes();
                }
                
                videos.forEach((v, vIndex) => {
                    v.muted = true;
                    v.volume = 0;
                    volumeLog('Individual mute: Video', vIndex, '- muted');
                });
                slider.value = '0';
            }
            updateVolumeIcon(volumeIcon, slider.value);
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
    
    if (createdCount > 0) {
        volumeLog('createVolumeSliders: Created', createdCount, 'sliders');
    }
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
    if (isNaN(globalMultiplier) || globalMultiplier < 0) globalMultiplier = 100;
    
    const videoTiles = document.querySelectorAll('.fullscreen-wrapper > .video');
    if (videoTiles.length === 0) return;

    videoTiles.forEach((tile) => {
        const username = getGuestUsername(tile);
        const videoElements = tile.querySelectorAll('video');
        const slider = tile.querySelector('.betternow-volume-slider .slider');
        const volumeIcon = tile.querySelector('.betternow-volume-slider .volume__icon i');

        if (videoElements.length === 0 || !username) return;
        
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

        videoElements.forEach((v) => {
            v.volume = effectiveVolume / 100;
            v.muted = effectiveVolume === 0;
        });

        // Individual slider shows base volume (not multiplied)
        if (slider) slider.value = baseVolume.toString();
        if (volumeIcon) updateVolumeIcon(volumeIcon, baseVolume.toString());
    });
}

// Reset volume controls state for new stream
function resetVolumeControls() {
    volumeLog('resetVolumeControls: Resetting for new stream');
    
    // Disconnect existing observer
    if (guestChangeObserver) {
        guestChangeObserver.disconnect();
        guestChangeObserver = null;
    }
    
    // Clear last guest usernames
    lastGuestUsernames = new Set();
    
    // Remove existing volume sliders
    document.querySelectorAll('.betternow-volume-slider').forEach(el => el.remove());
    
    // Remove global volume slider
    document.querySelectorAll('.betternow-global-volume').forEach(el => el.remove());
    document.querySelectorAll('.betternow-volume-label').forEach(el => el.remove());
    
    // Clear fullscreen-wrapper observer flag so it can be re-observed
    const fullscreenWrapper = document.querySelector('.fullscreen-wrapper');
    if (fullscreenWrapper) {
        delete fullscreenWrapper.dataset.volumeObserver;
    }
    
    // Reset initialized flag
    volumeInitialized = false;
}

// Initialize volume controls when DOM changes (instead of polling every second)
let volumeInitialized = false;

function initVolumeControls() {
    volumeLog('initVolumeControls() called');
    setupVolumeObserver();
    setupGuestChangeObserver();
    createVolumeSliders();
    updateVolumeSliderVisibility();
    createGlobalVolumeSlider();
    
    // Once we have the global slider created, we're fully initialized
    // The guestChangeObserver will handle future guest join/leave
    if (document.querySelector('.betternow-global-volume') && !volumeInitialized) {
        volumeLog('Volume controls fully initialized, stopping main observer');
        volumeControlsObserver.disconnect();
        volumeInitialized = true;
        
        // Clear initial load check since we successfully initialized
        if (typeof initialLoadCheckTimeout !== 'undefined' && initialLoadCheckTimeout) {
            clearTimeout(initialLoadCheckTimeout);
            initialLoadCheckTimeout = null;
        }
    }
}

// Observer to detect when video player appears (only needed for initial load)
let pendingInitTimeout = null;

const volumeControlsObserver = new MutationObserver((mutations) => {
    // Skip if already fully initialized
    if (volumeInitialized) return;
    
    let shouldInit = false;
    
    for (const mutation of mutations) {
        // Check for added nodes that might be video tiles or toolbar
        if (mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Only trigger for actual video-related elements
                    if (node.matches?.('.video, .fullscreen-wrapper, app-channel, .video-player') ||
                        node.querySelector?.('.video, .fullscreen-wrapper, .video-player')) {
                        shouldInit = true;
                        break;
                    }
                }
            }
        }
        if (shouldInit) break;
    }
    
    if (shouldInit) {
        // Debounce - cancel previous pending init and schedule new one
        if (pendingInitTimeout) {
            volumeLog('Observer: Debouncing (canceling previous pending init)');
            clearTimeout(pendingInitTimeout);
        }
        volumeLog('Observer: Video element detected, scheduling init in 100ms');
        pendingInitTimeout = setTimeout(() => {
            pendingInitTimeout = null;
            initVolumeControls();
        }, 100);
    }
});

// Start observing once DOM is ready
function startVolumeObserver() {
    if (document.body) {
        volumeControlsObserver.observe(document.body, { childList: true, subtree: true });
        // Only run initial init if we haven't already
        if (!volumeInitialized) {
            initVolumeControls();
        }
    }
}

volumeLog('Volume module initialized');
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startVolumeObserver);
} else {
    startVolumeObserver();
}

// On initial page load, check if we're on a live stream - if not, clean up after timeout
let initialLoadCheckTimeout = setTimeout(() => {
    if (!isLiveStream() && !volumeInitialized) {
        volumeLog('Initial load: Not a live stream, cleaning up');
        volumeControlsObserver.disconnect();
    }
    initialLoadCheckTimeout = null;
}, LIVE_STREAM_CHECK_TIMEOUT);

// Handle navigation to new live streams
let lastStreamUrl = location.href;
let liveStreamObserver = null;
let liveStreamCheckTimeout = null;

function handleNavigation() {
    const newUrl = location.href;
    if (newUrl === lastStreamUrl) return;
    
    volumeLog('Navigation detected:', lastStreamUrl, '→', newUrl);
    lastStreamUrl = newUrl;
    
    // Stop any existing live stream observer
    if (liveStreamObserver) {
        liveStreamObserver.disconnect();
        liveStreamObserver = null;
    }
    
    // Clear any pending timeout
    if (liveStreamCheckTimeout) {
        clearTimeout(liveStreamCheckTimeout);
        liveStreamCheckTimeout = null;
    }
    
    // Always reset first - the old stream's DOM may still be present
    resetVolumeControls();
    
    // Wait for Angular to update the DOM before checking/observing
    setTimeout(() => {
        // Check if we're now on a live stream (requires multiple conditions)
        if (isLiveStream()) {
            volumeLog('Live stream detected, reinitializing volume controls');
            
            volumeControlsObserver.observe(document.body, { childList: true, subtree: true });
            initVolumeControls();
        } else {
            // Not immediately a live stream - start observer to watch for it
            liveStreamObserver = new MutationObserver(() => {
                if (isLiveStream()) {
                    volumeLog('Live stream detected (via observer), reinitializing volume controls');
                    liveStreamObserver.disconnect();
                    liveStreamObserver = null;
                    
                    if (liveStreamCheckTimeout) {
                        clearTimeout(liveStreamCheckTimeout);
                        liveStreamCheckTimeout = null;
                    }
                    
                    volumeControlsObserver.observe(document.body, { childList: true, subtree: true });
                    initVolumeControls();
                }
            });
            
            liveStreamObserver.observe(document.body, { childList: true, subtree: true });
            
            // Set timeout to clean up if still not a live stream
            liveStreamCheckTimeout = setTimeout(() => {
                if (!isLiveStream()) {
                    volumeLog('Not a live stream, cleaning up volume controls');
                    
                    if (liveStreamObserver) {
                        liveStreamObserver.disconnect();
                        liveStreamObserver = null;
                    }
                    
                    volumeControlsObserver.disconnect();
                }
                liveStreamCheckTimeout = null;
            }, LIVE_STREAM_CHECK_TIMEOUT);
        }
    }, 300);
}

// Inject History API interceptor into page context
// Content scripts run in isolated world, so we need to inject to catch Angular's navigation
function injectNavigationInterceptor() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('js/features/navigation/navigation-interceptor.js');
    script.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

// Inject early
injectNavigationInterceptor();

// Listen for navigation events from page context
window.addEventListener('betternow:navigation', handleNavigation);

// Handle browser back/forward buttons
window.addEventListener('popstate', handleNavigation);
