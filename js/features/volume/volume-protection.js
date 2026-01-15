/*
 * Alex's BetterNow - Volume Protection (Page Context)
 *
 * This runs in the page context to intercept HTMLMediaElement.prototype.volume
 * and block external changes to protected videos.
 */

(function() {
    // Skip if already installed
    if (window.__betternowVolumeProtectionInstalled) return;
    window.__betternowVolumeProtectionInstalled = true;

    const originalVolumeDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
    const originalMutedDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted');

    // Store originals on window for potential future use
    window.__betternowOriginalVolumeDesc = originalVolumeDesc;
    window.__betternowOriginalMutedDesc = originalMutedDesc;

    // Intercept volume at prototype level
    Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
        get() {
            return originalVolumeDesc.get.call(this);
        },
        set(val) {
            // Always allow if BetterNow is making the change
            if (window.__betternowChangingVolume) {
                originalVolumeDesc.set.call(this, val);
                return;
            }

            // Check if this video is protected
            if (this.dataset && this.dataset.betternowProtected === 'true') {
                const intendedVol = parseFloat(this.dataset.betternowIntendedVolume);
                if (!isNaN(intendedVol) && Math.abs(val - intendedVol) > 0.001) {
                    return; // Block the change
                }
            }

            // Not protected or no intended value - allow the change
            originalVolumeDesc.set.call(this, val);
        },
        configurable: true,
        enumerable: true
    });

    // Intercept muted at prototype level
    Object.defineProperty(HTMLMediaElement.prototype, 'muted', {
        get() {
            return originalMutedDesc.get.call(this);
        },
        set(val) {
            // Always allow if BetterNow is making the change
            if (window.__betternowChangingVolume) {
                originalMutedDesc.set.call(this, val);
                return;
            }

            // Check if this video is protected
            if (this.dataset && this.dataset.betternowProtected === 'true') {
                const intendedMuted = this.dataset.betternowIntendedMuted === 'true';
                if (val !== intendedMuted) {
                    return; // Block the change
                }
            }

            // Not protected or no intended value - allow the change
            originalMutedDesc.set.call(this, val);
        },
        configurable: true,
        enumerable: true
    });

    // Listen for messages from content script to set the flag
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'BETTERNOW_VOLUME_FLAG') {
            window.__betternowChangingVolume = event.data.value;
        }
    });
})();