const myUsernames = ["Alex"];
const friendUsernames = ["Menacing", "JusWithoutTheTin", "ThatDudeJon", "TeressaMarie"];
const hiddenBroadcasters = ["mcfroger3", "unhingedfaerie"];

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
    6767: "linear-gradient(115.62deg, rgb(255, 215, 0) 17.43%, rgb(255, 180, 0) 84.33%)"
};

const myGradient = gradients[6767];
const friendGradient = gradients[1000];

const myTextColor = "#FFD700"; // Gold
const friendTextColor = "#FFFFFF"; // White

// MutationObserver to hide broadcasters as soon as they appear
const observer = new MutationObserver((mutations) => {
    hideBroadcasters();
});

let gridViewEnabled = false;

function applyBorders() {
    myUsernames.forEach(username => {
        document.querySelectorAll(`span[title="${username}"]`).forEach(span => {
            const li = span.closest('li');
            if (li && li.closest('app-chat-list')) {
                const card = li.querySelector('.user-card');
                if (card) {
                    card.style.border = '2px solid transparent';
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
            }
        });
    });

    friendUsernames.forEach(username => {
        document.querySelectorAll(`span[title="${username}"]`).forEach(span => {
            const li = span.closest('li');
            if (li && li.closest('app-chat-list')) {
                const card = li.querySelector('.user-card');
                if (card) {
                    card.style.border = '2px solid transparent';
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
            if (card) {
                card.style.display = 'none';
            }
        });
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

applyBorders();
hideBroadcasters();

setInterval(createGridToggle, 1000);
setInterval(applyGridView, 1000);
setInterval(applyBorders, 1000);

observer.observe(document.body, {
    childList: true,
    subtree: true
});