// ============ Explore / Hidden Broadcasters ============
// Carousel navigation and hidden broadcaster filtering on explore page

let lastSkipTime = 0;
let lastDirection = 'next';

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
