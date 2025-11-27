// Defensive check: Only run in Chrome extension context
if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.sync) {
    console.warn("chrome.storage.sync is not available. This script must run as a Chrome extension.");
} else {
    const ALLOW_RULE_ID_OFFSET = 200000;
    const ALLOW_RULE_RESOURCE_TYPES = [
        "main_frame",
        "sub_frame",
        "xmlhttprequest",
        "script",
        "image",
        "media",
        "font",
        "stylesheet",
        "ping",
        "other"
    ];

    function sanitizeDomain(domain = "") {
        return domain
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\/.*$/, "");
    }

    function sanitizeDomains(domains) {
        if (!Array.isArray(domains)) return [];
        const unique = new Set();
        domains.forEach((domain) => {
            const sanitized = sanitizeDomain(domain);
            if (sanitized) unique.add(sanitized);
        });
        return Array.from(unique);
    }

    function hostnameMatchesAllowlist(hostname, whitelist = []) {
        if (!hostname) return false;
        return whitelist.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    }

    function buildAllowlistRules(domains) {
        const sanitized = sanitizeDomains(domains);
        return sanitized.map((domain, index) => ({
            id: ALLOW_RULE_ID_OFFSET + index,
            priority: 1000,
            action: { type: "allowAllRequests" },
            condition: {
                initiatorDomains: [domain],
                resourceTypes: ALLOW_RULE_RESOURCE_TYPES
            }
        }));
    }

    function syncDynamicRules(callback) {
        if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.updateDynamicRules) {
            if (typeof callback === "function") callback();
            return;
        }

        chrome.storage.sync.get(["blockingEnabled", "customRules", "whitelist"], (data) => {
            const enabled = data.blockingEnabled !== false;
            const customRules = Array.isArray(data.customRules) ? data.customRules : [];
            const whitelist = data.whitelist || [];

            chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
                const removeRuleIds = existingRules.map((rule) => rule.id);
                const allowlistRules = buildAllowlistRules(whitelist);
                const rulesToAdd = enabled ? [...customRules, ...allowlistRules] : [];

                chrome.declarativeNetRequest.updateDynamicRules(
                    {
                        addRules: rulesToAdd,
                        removeRuleIds
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            console.warn("Failed to sync dynamic rules:", chrome.runtime.lastError.message);
                        }
                        if (typeof callback === "function") {
                            callback();
                        }
                    }
                );
            });
        });
    }

    // Enforce blocking state on startup
    function enforceBlockingState() {
        syncDynamicRules();
    }

    // Helper: check if a URL is allowlisted
    function isAllowlisted(url, callback) {
        try {
            const hostname = new URL(url).hostname;
            chrome.storage.sync.get(['whitelist'], (data) => {
                const whitelist = sanitizeDomains(data.whitelist || []);
                callback(hostnameMatchesAllowlist(hostname, whitelist));
            });
        } catch (e) {
            callback(false);
        }
    }

    // Log blocked requests (requires declarativeNetRequestWithDebug permission in manifest)
    if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
        chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
            isAllowlisted(info.request.url, (allowlisted) => {
                if (allowlisted) return; // Don't log or block if allowlisted
                // Store log in chrome.storage.local (keep last 100 entries)
                chrome.storage.local.get(['blockedLog'], (data) => {
                    const log = data.blockedLog || [];
                    log.unshift({
                        time: new Date().toISOString(),
                        url: info.request.url,
                        ruleId: info.rule.ruleId,
                        tabId: info.tabId
                    });
                    if (log.length > 100) log.length = 100;
                    chrome.storage.local.set({ blockedLog: log });
                });
            });
        });
    }

    // background.js (service worker for Manifest V3)
    // Handles network-level blocking and DNR rules

    chrome.runtime.onInstalled.addListener(() => {
        console.log('ADSHIELD-X background service worker installed.');
        enforceBlockingState();
    });

    chrome.runtime.onStartup.addListener(() => {
        console.log('ADSHIELD-X background service worker started.');
        enforceBlockingState();
    });

    // Listen for messages for advanced features (dynamic rules, whitelist, etc.)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || !message.type) return;
        // Content script requests blocking status
        if (message.type === 'GET_BLOCKING_STATUS') {
            chrome.storage.sync.get(['blockingEnabled'], (data) => {
                sendResponse({ enabled: data.blockingEnabled !== false });
            });
            return true;
        }

        if (message.type === 'SHOULD_BLOCK_PAGE') {
            chrome.storage.sync.get(['blockingEnabled', 'whitelist'], (data) => {
                const enabled = data.blockingEnabled !== false;
                const whitelist = sanitizeDomains(data.whitelist || []);
                let hostname = "";
                try {
                    hostname = new URL(message.url || '').hostname;
                } catch (e) {
                    hostname = "";
                }
                const allowlisted = hostnameMatchesAllowlist(hostname, whitelist);
                sendResponse({ shouldBlock: enabled && !allowlisted });
            });
            return true;
        }

        // Content script requests blocked log
        if (message.type === 'GET_BLOCKED_LOG') {
            chrome.storage.local.get(['blockedLog'], (data) => {
                sendResponse({ log: data.blockedLog || [] });
            });
            return true;
        }

        if (message.type === 'PING') {
            sendResponse({ status: 'Service worker active' });
        }

        // Add dynamic DNR rules
        if (message.type === 'ADD_DNR_RULES' && Array.isArray(message.rules)) {
            syncDynamicRules(() => {
                sendResponse({ status: 'Rules synced after addition', rules: message.rules });
            });
            return true;
        }

        // Remove dynamic DNR rules
        if (message.type === 'REMOVE_DNR_RULES' && Array.isArray(message.ruleIds)) {
            syncDynamicRules(() => {
                sendResponse({ status: 'Rules synced after removal', ruleIds: message.ruleIds });
            });
            return true;
        }

        // Toggle blocking (enable/disable all custom rules)
        if (message.type === 'TOGGLE_BLOCKING' && typeof message.enabled === 'boolean') {
            chrome.storage.sync.set({ blockingEnabled: message.enabled }, () => {
                syncDynamicRules(() => {
                    sendResponse({ status: message.enabled ? 'Blocking enabled' : 'Blocking disabled' });
                });
            });
            return true; // async response
        }

        if (message.type === 'SYNC_DYNAMIC_RULES') {
            syncDynamicRules(() => sendResponse({ status: 'Rules synchronized' }));
            return true;
        }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync') return;
        if (changes.whitelist || changes.customRules || changes.blockingEnabled) {
            syncDynamicRules();
        }
    });
}
