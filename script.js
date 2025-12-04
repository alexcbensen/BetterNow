const myUsernames = ["Alex"];
const friendUsernames = ["Menacing", "JusWithoutTheTin"];

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

function applyBorders() {
    myUsernames.forEach(username => {
        document.querySelectorAll(`span[title="${username}"]`).forEach(span => {
            const li = span.closest('li');
            if (li) {
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
                    usernameSpan.style.color = myTextColor;
                }
            }
        });
    });

    friendUsernames.forEach(username => {
        document.querySelectorAll(`span[title="${username}"]`).forEach(span => {
            const li = span.closest('li');
            if (li) {
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
                    usernameSpan.style.color = friendTextColor;
                }
            }
        });
    });
}

applyBorders();
setInterval(applyBorders, 1000);