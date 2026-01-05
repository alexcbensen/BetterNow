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
                    card.style.backgroundImage = `linear-gradient(#212121, #212121), ${friendGradient}`;
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

const observer = new MutationObserver(() => {
    hideBroadcasters();
    hideCarouselBroadcasters();
});

applyBorders();
hideBroadcasters();
hideCarouselBroadcasters();

setInterval(createGridToggle, 1000);
setInterval(applyGridView, 1000);
setInterval(applyBorders, 1000);
setInterval(hideCarouselBroadcasters, 200);

observer.observe(document.body, {
    childList: true,
    subtree: true
});