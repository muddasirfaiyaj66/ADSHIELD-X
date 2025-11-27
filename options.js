// options.js for ADSHIELD-X
// Handles adding/removing custom rules and syncing with background


if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
    // Do nothing: silently fail if not in extension context
} else {
    document.addEventListener('DOMContentLoaded', () => {
        const rulesList = document.getElementById('rules');
        const addRuleForm = document.getElementById('addRuleForm');
        const urlFilterInput = document.getElementById('urlFilter');

        // Load rules from storage
        function loadRules() {
            chrome.storage.sync.get(['customRules'], (data) => {
                const rules = data.customRules || [];
                rulesList.innerHTML = '';
                rules.forEach(rule => {
                    const li = document.createElement('li');
                    li.className = 'rule-item';
                    li.textContent = rule.condition.urlFilter;
                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = 'Remove';
                    removeBtn.onclick = () => removeRule(rule.id);
                    li.appendChild(removeBtn);
                    rulesList.appendChild(li);
                });
            });
        }

        // Add rule
        addRuleForm.onsubmit = (e) => {
            e.preventDefault();
            const urlFilter = urlFilterInput.value.trim();
            if (!urlFilter) return;
            chrome.storage.sync.get(['customRules'], (data) => {
                const rules = data.customRules || [];
                const newId = Date.now();
                const newRule = {
                    id: newId,
                    priority: 1,
                    action: { type: 'block' },
                    condition: { urlFilter }
                };
                rules.push(newRule);
                chrome.storage.sync.set({ customRules: rules }, () => {
                    chrome.runtime.sendMessage({ type: 'SYNC_DYNAMIC_RULES' }, () => {
                        loadRules();
                        urlFilterInput.value = '';
                    });
                });
            });
        };

        // Remove rule
        function removeRule(ruleId) {
            chrome.storage.sync.get(['customRules'], (data) => {
                let rules = data.customRules || [];
                rules = rules.filter(r => r.id !== ruleId);
                chrome.storage.sync.set({ customRules: rules }, () => {
                    chrome.runtime.sendMessage({ type: 'SYNC_DYNAMIC_RULES' }, () => {
                        loadRules();
                    });
                });
            });
        }

        loadRules();
    });
}
