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
        const skipBtn = document.querySelector(".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button");
        if (skipBtn && skipBtn.offsetParent !== null) {
            skipBtn.click();
        }

        const player = document.querySelector('.html5-video-player');
        const mainVideo = document.querySelector('.html5-main-video');
        const adVideo = document.querySelector('.ad-showing video, .ad-interrupting video');

        if (!mainVideo) return;

        const adShowing = player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));

        if (adShowing) {
            // Force ad video to end immediately
            if (adVideo) {
                if (adVideo.duration && adVideo.duration > 0) {
                    adVideo.currentTime = adVideo.duration - 0.1;
                }
                adVideo.playbackRate = 16;
                adVideo.muted = true;
            }

            // Also manipulate main video if it's showing ad (only if duration is valid)
            // Note: currentTime modification is handled in the aggressive interval check
            // to properly track and restore the original position
            if (mainVideo.duration && mainVideo.duration > 0) {
                mainVideo.playbackRate = 16;
                mainVideo.muted = true;
            }

            // Try to access YouTube player API to force skip
            try {
                const ytPlayer = document.querySelector('#movie_player');
                if (ytPlayer && ytPlayer.getAdState && ytPlayer.getDuration) {
                    const adState = ytPlayer.getAdState();
                    if (adState !== -1) {
                        // Force end ad
                        if (ytPlayer.seekTo) {
                            ytPlayer.seekTo(ytPlayer.getDuration(), true);
                        }
                    }
                }
            } catch (e) {
                // YouTube API not available, continue with DOM manipulation
            }

            // Remove ad overlays and containers
            const adOverlays = document.querySelectorAll('.ytp-ad-overlay-container, .ytp-ad-text-overlay, .ytp-ad-overlay-close-button');
            adOverlays.forEach(el => el.remove());
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

        // More frequent interval for YouTube to catch ads immediately
        const interval = isYouTube ? 100 : 1000;
        setInterval(runBlockers, interval);

        // Extra aggressive check for YouTube ads
        if (isYouTube) {
            let lastAdState = false;
            let originalMuteState = false;
            let originalCurrentTime = 0;
            setInterval(() => {
                const player = document.querySelector('.html5-video-player');
                const mainVideo = document.querySelector('.html5-main-video');
                const adShowing = player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));

                if (adShowing) {
                    if (!lastAdState && mainVideo) {
                        // Store original state when ad first appears
                        originalMuteState = mainVideo.muted;
                        originalCurrentTime = mainVideo.currentTime || 0;
                    } else if (!lastAdState && !mainVideo) {
                        // mainVideo disappeared before we could capture state, reset tracking
                        lastAdState = false;
                        originalMuteState = false;
                        originalCurrentTime = 0;
                        continue;
                    }
                    lastAdState = true;
                    handleYouTubePlayer();
                    // Force click skip button multiple times if needed
                    const skipBtn = document.querySelector(".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button");
                    if (skipBtn && skipBtn.offsetParent !== null) {
                        skipBtn.click();
                        setTimeout(() => {
                            if (skipBtn.offsetParent !== null) {
                                skipBtn.click();
                            }
                        }, 50);
                    }
                    // Check if mainVideo disappeared while ad is showing (handles navigation during ad)
                    if (lastAdState && !mainVideo) {
                        lastAdState = false;
                        originalMuteState = false;
                        originalCurrentTime = 0;
                    }
                } else if (lastAdState) {
                    // Ad just ended
                    lastAdState = false;
                    if (mainVideo) {
                        // Ensure video starts playing immediately
                        if (mainVideo.paused) {
                            mainVideo.play().catch(() => { });
                        }
                        // Reset playback rate and restore original mute state
                        mainVideo.playbackRate = 1;
                        mainVideo.muted = originalMuteState;
                        // Restore original playback position if it was modified
                        if (originalCurrentTime > 0 && mainVideo.duration && originalCurrentTime < mainVideo.duration) {
                            mainVideo.currentTime = originalCurrentTime;
                        }
                    }
                    // Reset state even if mainVideo is gone (handles navigation during ad)
                    originalMuteState = false;
                    originalCurrentTime = 0;
                }
            }, 50);
        }
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
