function blockYouTubeAds() {
    const adSelectors = [
        ".video-ads",
        ".ytp-ad-module",
        ".ytp-ad-player-overlay",
        ".ytp-ad-image-overlay",
        ".ytp-ad-text-overlay",
        "ytd-promoted-video-renderer",
        "ytd-display-ad-renderer"
    ];

    adSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Auto skip ads
    let skipBtn = document.querySelector(".ytp-ad-skip-button, .ytp-ad-skip-button-modern");
    if (skipBtn) skipBtn.click();
}

// Run on interval because YouTube loads ads dynamically
setInterval(blockYouTubeAds, 500);
