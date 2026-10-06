# PopChat for Twitch

An unofficial extension, not provided or endorsed by Twitch.

## Install the local package

1. Extract the runtime/store ZIP into its own folder. Its `manifest.json` is at the ZIP root.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge and turn on Developer mode.
3. Choose “Load unpacked” and select that extracted folder itself. If using the source ZIP instead, select `popchat-for-twitch/extension` inside the extracted source package. In either case, choose the folder directly containing `manifest.json`.
4. On first installation, a local extension page opens automatically in a new tab. Review the information and choose “Enable” if you agree. Choose “Not now” to leave the extension disabled.
5. Reload your Twitch pages if needed.

The extension’s toolbar popup shows whether it is enabled. Choose “Help and settings” to open the dedicated page, or return to its tab if it is already open. You can enable or disable the features on that page at any time.

## Use

On a Twitch live channel page, click the player’s settings gear. Choose “Popout” for a regular window or “Popout (always on top)” for an always-on-top window. Choose the chat layout at the top of the small window.

AUTO adapts to the window; SIDE puts chat on the right; BOTTOM puts it below the video; HIDE hides chat while keeping it loaded. Choose another mode to show it again. Reload refreshes official chat. Chat window opens official chat separately.

Keep the original Twitch tab open while using the always-on-top window. Closing, reloading or navigating away from the original tab also closes the small window. Closing the small window returns the video to the original tab.

## Scope and limits

Designed for desktop Chrome and Edge with Document Picture-in-Picture support (Chromium 116 or later). Mobile, Firefox, VODs and clips are outside the supported scope. The menu entry is added only when the extension recognizes Twitch’s menu structure; a Twitch update may make it unavailable. Closing, reloading or navigating the original tab closes the always-on-top window. Some Twitch player overlays and settings do not move with the video. Chat sign-in and posting depend on Twitch and browser settings.

The always-on-top window uses Document Picture-in-Picture. This does not add chat to standard video-only PiP.

## Privacy

Once enabled, the extension uses the current channel URL, existing video element and player/menu structure locally to arrange video and chat. Official chat connects directly to Twitch and may use your Twitch sign-in. Only display settings and your consent choice are saved locally; no data is sent to the developer.

Until you enable it, the extension does not read the channel URL or player/menu structure and does not load official chat. Open “Help and settings” from the extension’s toolbar popup and choose “Disable” on the dedicated page to withdraw consent. This closes the extension-managed embedded chat and always-on-top window and restores the video, while keeping your display settings.

The extension has no analytics, advertising or independent server. It reads the current channel from the page URL only to show the matching official chat. Only layout mode, window width/height and your consent choice are saved in local extension storage; they are not synced. It does not save chat, browsing history, channel names, usernames, credentials or cookies, and does not read the content of the official chat frame. Official Twitch embeds connect directly to Twitch and use Twitch’s session where the browser allows it. Twitch handles sign-in and chat under its own policies. The extension uses only the storage permission and runs on HTTPS pages at www.twitch.tv and player.twitch.tv.

## Update

Close the small window. Replace the entire folder registered with the browser at the same path, rather than merging files into the old folder. Reload the extension in the browser’s extension manager, then reload all open Twitch pages. Normal updates retain saved layout settings.

Updates and browser startup do not open the guide page automatically. Your consent choice saved in version 1.5.0 is retained too. Existing display settings alone do not count as consent. When upgrading from a version without the consent prompt, open “Help and settings” from the extension’s toolbar popup, review the information and choose “Enable” before using the features.
