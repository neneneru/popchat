# Native menu compatibility

The native Twitch settings menu is not a public extension API. PopChat enhances only this exact visible structure:

`div[data-a-target="player-settings-menu"] > div > button[role="menuitem"] > div > div`

The final label must be a leaf, and the candidate must be unique, visible and enabled. Unknown structures and labels are left untouched. The extension creates its own adjacent row and copies only presentation classes, never Twitch handlers or native data attributes.

## Supported native labels

These values are the exact allowlist shipped in `extension/gear-menu.js`:

- Japanese: ポップアウト
- English: Popout Player
- Korean: 팝업 플레이어
- Simplified Chinese: 弹出播放器
- Spanish: Reproductor emergente
- German: Pop-out-Player
- French: Ouvrir dans nouvelle fenêtre
- Russian: Открыть в отдельном окне
- Arabic: مشغّل منبثق

The extension's 11 UI translations are independent of Twitch's interface language. Brazilian Portuguese is not in the native-label allowlist, so its Twitch menu does not receive the always-on-top entry. English or another supported Twitch interface language can be used instead. No Indonesian native label is asserted. Adding chat to Twitch's normal popout does not depend on these labels.

A locale match alone does not prove the current site's DOM structure is compatible. Twitch can change it independently, and unknown variants fail closed without adding a fallback launcher or modifying the original popout control.

## References

- [Twitch player options](https://help.twitch.tv/s/article/a-tour-of-your-channel-page)
- [Official chat embedding](https://dev.twitch.tv/docs/embed/chat/)
- [Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)

The automated tests use controlled DOM fixtures. They do not substitute for a live browser check of each Twitch interface language.
