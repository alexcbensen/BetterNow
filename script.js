const myUsernames = ["Alex"];
const friendUsernames = ["Menacing"];

const myColor = "rgba(212, 175, 55, 0.5)"; // Gold
const friendColor = "rgba(0, 191, 255, 0.5)"; // Cyan

function applyBorders() {
    myUsernames.forEach(username => {
        document.querySelectorAll(`span[title="${username}"]`).forEach(span => {
            const li = span.closest('li');
            if (li) {
                const card = li.querySelector('.user-card');
                if (card) {
                    card.style.border = `2px solid ${myColor}`;
                    card.style.borderRadius = '8px';
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
                    card.style.border = `2px solid ${friendColor}`;
                    card.style.borderRadius = '8px';
                }
            }
        });
    });
}

applyBorders();
setInterval(applyBorders, 1000);