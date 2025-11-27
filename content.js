(() => {
    const isChromeExtension = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage;
    const isYouTube = location.hostname.includes('youtube.com');
    let started = false;

    const genericSelectors = [
        'iframe[src*="doubleclick"]',
        'iframe[src*="googlesyndication"]',
        'iframe[src*="adservice"]',
        '[class*="ad-banner"]',
        '[class*="ad-container"]',
        '[id^="ads-"]',
        '[id^="ad-"]',
        '[data-ad-name]',
        '.adsbygoogle',
        '.sponsored',
        '.ad-slot',
        '.advertisement',
        '.ad-unit',
        '.sticky-ad',
        '.ad-placeholder'
    ];

    const youtubeSelectors = [
        ".video-ads",
        ".ytp-ad-module",
        ".ytp-ad-player-overlay",
        ".ytp-ad-image-overlay",
        ".ytp-ad-text-overlay",
        "ytd-promoted-video-renderer",
        "ytd-display-ad-renderer",
        ".ytp-ad-preview-container",
        ".ytp-ad-progress"
    ];

    function removeElements(selectors) {
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((el) => el.remove());
        });
    }

    function handleYouTubePlayer() {
        const skipBtn = document.querySelector(".ytp-ad-skip-button, .ytp-ad-skip-button-modern");
        if (skipBtn) skipBtn.click();

        const adVideo = document.querySelector('.ad-showing video');
        if (adVideo) {
            adVideo.currentTime = adVideo.duration || adVideo.currentTime;
            adVideo.muted = true;
        }
    }

    function runBlockers() {
        removeElements(genericSelectors);
        if (isYouTube) {
            removeElements(youtubeSelectors);
            handleYouTubePlayer();
        }
    }

    function initBlockers() {
        if (started) return;
        started = true;
        runBlockers();

        const observer = new MutationObserver(() => runBlockers());
        observer.observe(document.documentElement || document.body, {
            childList: true,
            subtree: true
        });

        setInterval(runBlockers, 1000);
    }

    function startBlocking() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initBlockers, { once: true });
        } else {
            initBlockers();
        }
    }

    if (!isChromeExtension) {
        startBlocking();
        return;
    }

    chrome.runtime.sendMessage({ type: 'SHOULD_BLOCK_PAGE', url: location.href }, (response) => {
        if (chrome.runtime.lastError) {
            startBlocking();
            return;
        }
        if (response && response.shouldBlock) {
            startBlocking();
        }
    });
})();
