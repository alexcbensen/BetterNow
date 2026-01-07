// Chat, grid view, and carousel features

let gridViewEnabled = false;
let lastSkipTime = 0;
let lastDirection = 'next';

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
    hiddenBroadcasters.forEach(username => {
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
                const isHidden = hiddenBroadcasters.some(hidden =>
                    hidden.toLowerCase() === username.toLowerCase()
                );

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