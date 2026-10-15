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
- Brazilian Portuguese: Pop-out de reprodução

The extension's 11 UI translations are independent of Twitch's interface language. Adding live chat to Twitch's normal popout does not depend on these labels. The VOD replay-popup entry uses the same adapter and label allowlist; embedded VODs use the localized full-archive entry. Neither VOD entry requires Document PiP support. There is no floating fallback.

A locale match alone does not prove the current site's DOM structure is compatible. Twitch can change it independently, and unknown variants fail closed without adding a fallback launcher or modifying the original popout control.

## Browser evidence: 2026-10-15

The Twitch player settings menu was inspected in Chrome with Twitch set to `Português - Brasil` (`document.documentElement.lang` was `pt-BR`).

The visible player settings menu displayed the exact text `Pop-out de reprodução`. Read-only inspection of that displayed button found:

```html
<div data-a-target="player-settings-menu">
  <div class="Layout-sc-1xcs6mc-0 eDiLRr">
    <button class="ScInteractableBase-sc-ofisyf-0 ScInteractableDefault-sc-ofisyf-1 cQzzvm iTnOTE tw-interactable" role="menuitem">
      <div class="Layout-sc-1xcs6mc-0 dmmLGq">
        <div class="Layout-sc-1xcs6mc-0 dmulkQ">Pop-out de reprodução</div>
      </div>
    </button>
  </div>
</div>
```

The excerpt shows the observed parent menu plus the observed item only; other menu items are omitted. The class strings are observation evidence, not new selectors. The button had no stable action-specific data attribute, so the fix adds only the verified Portuguese label and retains the existing hierarchy and uniqueness guards.

The complete visible Twitch language selector contained 31 entries and no Indonesian/Bahasa Indonesia option. There is therefore no observed native Indonesian string to add. Indonesian extension controls remain translated and can accompany a Twitch UI in English or another recognized language. This observation does not claim that Indonesian is unavailable on every Twitch surface or future build.

This was a native menu/DOM inspection, not execution of the extension in every locale.

## References

- [Twitch player options](https://help.twitch.tv/s/article/a-tour-of-your-channel-page)
- [Official chat embedding](https://dev.twitch.tv/docs/embed/chat/)
- [Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)

The automated tests use controlled DOM fixtures. They do not substitute for a live browser check of each Twitch interface language.
