// ============ Auto-Confirm ============
// Automatically clicks through confirmation dialogs

const AUTO_CONFIRM_DEBUG = false;

function autoConfirmLog(...args) {
    if (AUTO_CONFIRM_DEBUG) {
        console.log('[BetterNow AutoConfirm]', new Date().toISOString().substr(11, 12), ...args);
    }
}

// ============ 18+ Age Verification ============

function handle18PlusModal(modal) {
    autoConfirmLog('18+ modal detected, auto-confirming...');
    
    // Click the checkbox/slider wrapper
    const checkboxWrapper = modal.querySelector('app-checkbox-with-text .wrapper');
    if (checkboxWrapper) {
        checkboxWrapper.click();
        autoConfirmLog('Clicked checkbox');
    }
    
    // Wait for button to become enabled, then click it
    setTimeout(() => {
        const joinButton = modal.querySelector('.button--green:not([disabled])');
        if (joinButton) {
            joinButton.click();
            autoConfirmLog('Clicked Join Stream button');
        } else {
            autoConfirmLog('Join button not yet enabled, retrying...');
            // Retry a few times
            let retries = 0;
            const retryInterval = setInterval(() => {
                const btn = modal.querySelector('.button--green:not([disabled])');
                if (btn) {
                    btn.click();
                    autoConfirmLog('Clicked Join Stream button (retry)');
                    clearInterval(retryInterval);
                } else if (++retries >= 10) {
                    autoConfirmLog('Join button never enabled, giving up');
                    clearInterval(retryInterval);
                }
            }, 100);
        }
    }, 100);
}

// ============ Observer Setup ============

function setupAutoConfirmObserver() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                
                // Check if this is a modal
                const modal = node.matches?.('.modal-content') ? node : node.querySelector?.('.modal-content');
                if (!modal) continue;
                
                const title = modal.querySelector('.title');
                if (!title) continue;
                
                const titleText = title.textContent.trim();
                
                // 18+ Age Verification
                if (titleText.includes('confirm your age')) {
                    setTimeout(() => handle18PlusModal(modal), 200);
                    continue;
                }
                
                // Add more auto-confirm handlers here as needed
                // Example:
                // if (titleText.includes('some other confirmation')) {
                //     handleSomeOtherModal(modal);
                //     continue;
                // }
            }
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    autoConfirmLog('Auto-confirm observer started');
}

// Initialize
setupAutoConfirmObserver();
