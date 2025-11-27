// popup.js for ADSHIELD-X
// Handles quick enable/disable and status display

document.addEventListener('DOMContentLoaded', () => {
    const statusText = document.getElementById('statusText');
    const toggleBtn = document.getElementById('toggleBtn');

    function updateStatus() {
        chrome.storage.sync.get(['blockingEnabled'], (data) => {
            const enabled = data.blockingEnabled !== false;
            statusText.textContent = enabled ? 'Enabled' : 'Disabled';
            toggleBtn.textContent = enabled ? 'Disable Blocking' : 'Enable Blocking';
        });
    }

    updateStatus();

    toggleBtn.onclick = () => {
        chrome.storage.sync.get(['blockingEnabled'], (data) => {
            const enabled = data.blockingEnabled !== false;
            chrome.runtime.sendMessage({ type: 'TOGGLE_BLOCKING', enabled: !enabled }, () => {
                // After background updates, refresh status
                updateStatus();
            });
        });
    };
});
