# ADSHIELD-X

ADSHIELD-X is a Chrome extension that blocks YouTube ads and general website ads using both network and DOM-based blocking.

## Features

- Blocks ad requests from major ad networks (Google, YouTube, DoubleClick, etc.)
- Removes YouTube ad elements and auto-skips video ads
- Uses Chrome's Declarative Net Request API for efficient blocking
- Custom rules and per-site allowlisting from the Options page
- Popup toggle to instantly enable/disable blocking without reloading the extension

## Installation

1. Download or clone this repository.
2. Go to `chrome://extensions/` in your Chrome browser.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select the `adshield-x` folder.

## Usage

- Click the toolbar icon to quickly toggle blocking on or off.
- Use **Options → Custom Rules** to add your own URL filter patterns (`*example.com/ads*`).
- Use **Options → Whitelist** to allowlist domains that should be ignored by the blocker.
- Rules and whitelist entries sync via your Chrome profile.

## Publishing

- Ensure all files are present: `manifest.json`, `background.js`, `content.js`, `rules.json`, and assets (icons).
- Add a privacy policy (see below).
- Zip the folder and upload to the Chrome Web Store Developer Dashboard.

## Privacy Policy

This extension does not collect, store, or transmit any personal data. All ad blocking is performed locally on your device.

## Support

For issues or suggestions, please contact the developer via the Chrome Web Store listing.
