// whitelist.js for ADSHIELD-X
// Handles allowlisting sites from options page

if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
    // Not running inside Chrome extension context
} else {
    document.addEventListener('DOMContentLoaded', () => {
        const whitelistForm = document.getElementById('addWhitelistForm');
        const whitelistInput = document.getElementById('whitelistDomain');
        const whitelistList = document.getElementById('whitelist');

        function sanitizeDomain(domain = '') {
            return domain
                .trim()
                .toLowerCase()
                .replace(/^https?:\/\//, '')
                .replace(/\/.*$/, '');
        }

        function notifyBackground() {
            chrome.runtime.sendMessage({ type: 'SYNC_DYNAMIC_RULES' });
        }

        function loadWhitelist() {
            chrome.storage.sync.get(['whitelist'], (data) => {
                const whitelist = data.whitelist || [];
                whitelistList.innerHTML = '';
                whitelist.forEach(domain => {
                    const li = document.createElement('li');
                    li.textContent = domain;
                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = 'Remove';
                    removeBtn.onclick = () => removeDomain(domain);
                    li.appendChild(removeBtn);
                    whitelistList.appendChild(li);
                });
            });
        }

        whitelistForm.onsubmit = (e) => {
            e.preventDefault();
            const sanitizedDomain = sanitizeDomain(whitelistInput.value);
            if (!sanitizedDomain) return;
            chrome.storage.sync.get(['whitelist'], (data) => {
                const whitelist = data.whitelist || [];
                if (!whitelist.includes(sanitizedDomain)) {
                    whitelist.push(sanitizedDomain);
                    chrome.storage.sync.set({ whitelist }, () => {
                        loadWhitelist();
                        notifyBackground();
                    });
                }
                whitelistInput.value = '';
            });
        };

        function removeDomain(domain) {
            chrome.storage.sync.get(['whitelist'], (data) => {
                let whitelist = data.whitelist || [];
                whitelist = whitelist.filter(d => d !== domain);
                chrome.storage.sync.set({ whitelist }, () => {
                    loadWhitelist();
                    notifyBackground();
                });
            });
        }

        loadWhitelist();
    });
}
