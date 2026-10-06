# PopChat for Twitch Privacy Policy

Last updated: 2026-10-06

Applies to version 1.5.1.

Publisher: [neneneru](https://github.com/neneneru)

Privacy contact and support: [GitHub Issues](https://github.com/neneneru/popchat/issues)

## 日本語

### 対象

このポリシーは、ブラウザ拡張機能「PopChat for Twitch」のデータの取り扱いを説明します。本拡張機能はTwitchとは提携・関連のない非公式の製品です。「使い方・設定」ページで説明を確認し、同意して有効にするまで、Twitchページの情報の処理、公式チャットの読み込み、Twitchページへの操作ボタンの追加は行いません。

本拡張機能を初めてインストールすると、説明と設定のページがブラウザのタブで開きます。このページは拡張機能に同梱されており、外部サイトから読み込むものではありません。更新時には自動で開きません。拡張機能のアイコンから、いつでも開き直せます。

### 端末内で使用する情報

本拡張機能は、現在開いているTwitchページのURLからチャンネル名を判定し、同じチャンネルの公式チャットを表示します。動画要素、ウィンドウの寸法、プレイヤーの設定メニューなど、その機能に必要なページ構造を端末内で確認します。Document Picture-in-Pictureでは、ページ上にある同じ動画要素を小窓へ移動します。動画や画面を録画・複製・アップロードする処理はありません。

ページURL、チャンネル名、動画要素、メニュー情報を閲覧履歴として記録せず、開発者へ送信しません。公式チャットのiframe内にあるメッセージ本文を、本拡張機能のコードが読み取り・保存・独自解析する処理はありません。

### 保存する設定

Chromeの拡張機能用ローカルストレージに、チャットの表示モード、最前面ウィンドウの幅・高さ、機能の有効化に同意したことを示す記録を保存します。具体的にはtccPreferencesに表示モード・幅・高さ、tccConsentVersionに同意済みのバージョン番号1、無効化時は0を保存します。氏名、アカウント、同意日時とは結び付けません。Chromeの同期ストレージは使いません。

拡張機能のアイコンから「使い方・設定」ページを開き、機能を無効にできます。無効にすると、この拡張機能が管理する最前面の小窓を閉じ、埋め込みチャットと追加メニューを取り除き、動画を元の位置へ戻します。「別窓」で開いたTwitchのチャットウィンドウは、自動では閉じません。表示設定は端末内に残ります。設定は通常の更新後も保持されますが、同意記録のない旧版からの更新では、同意して有効にするまで機能は動作しません。本拡張機能をアンインストールすると、拡張機能用ストレージの設定と同意記録は削除されます。

認証情報、パスワード、Cookie、チャットメッセージ、アカウント識別子、チャンネル名、閲覧履歴を本拡張機能の保存領域へ保存しません。

### Twitchとの通信

公式チャットの埋め込みや別窓を表示すると、ブラウザはTwitchへ接続します。チャットを表示するために、対象のチャンネル名がTwitchのURLの一部として渡されます。既存のTwitchセッションが使われる場合があり、チャットへ入力・送信する内容、IPアドレス、Cookieなどは、Twitchのサービスとブラウザ設定に従って処理されます。映像もTwitchの既存の配信接続を使用します。

Twitchによる処理、保存期間、削除方法、関連サービスについては、[Twitchのプライバシー通知](https://legal.twitch.com/en/legal/privacy-notice/)を確認してください。本拡張機能はTwitchの処理を管理しません。Twitch側の通信があるため、「外部通信を一切行わない」製品ではありません。

### 開発者による収集と利用

本拡張機能のコードには、開発者のサーバーへの送信、広告配信用SDK、分析SDK、利用状況追跡、テレメトリはありません。開発者は本拡張機能からチャット本文や閲覧履歴を受信しません。本拡張機能が扱う情報を販売せず、広告の個人最適化、信用判断、融資判断に利用・提供しません。

本拡張機能がユーザー情報を使用する範囲は、ここに記載した映像と公式チャットの小窓表示、設定の保存、および同意の記録の管理に限ります。この情報の取り扱いは、[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies)とLimited Useの要件に従います。

### 権限と対象サイト

- storage：上記の設定を端末内に保存するために使用します。
- 対象ページ：https://www.twitch.tv/* と https://player.twitch.tv/* のトップレベルHTTPSページで、プレイヤーとチャットの表示を補助します。

ブラウザの履歴一覧、全タブ一覧、Cookie API、OAuth認証、マイク、カメラ、画面キャプチャの権限は要求しません。対象TwitchページのURLは、そのページ内で機能を実行するために読み取ります。

### お問い合わせと更新

本拡張機能に関するプライバシーのお問い合わせは、上記のGitHub Issuesをご利用ください。Issuesへの投稿は公開されます。パスワード、認証コード、個人情報などは投稿しないでください。機能や情報の取り扱いを変更する場合は、このポリシーと必要な製品内の説明を更新します。

## English

### Scope

This policy explains how the browser extension PopChat for Twitch handles information. It is an independent product, not affiliated with or endorsed by Twitch. Until you review the disclosure and agree to enable it on the extension’s Help and settings page, it does not process Twitch page information, load official chat, or add controls to Twitch pages.

On first installation, a local onboarding and settings page opens in a browser tab. This page is bundled with the extension and is not loaded from an external website. Updates do not open it automatically. You can reopen it from the extension toolbar popup.

### Information used on your device

The extension reads the current Twitch page URL to identify the channel and display that channel's official chat. It examines the video element, window dimensions, and player settings-menu structure locally as needed for its features. Document Picture-in-Picture moves the existing video element into the small window. The extension does not record, duplicate, or upload video or screen captures.

The extension does not record page URLs, channel names, video elements, or menu information as a browsing-history log or send them to the developer. Its code does not read, store, or independently analyze message bodies inside the official chat iframe.

### Saved settings

The extension stores the chat layout mode, the width and height of the always-on-top window, and your enablement consent state in Chrome's local extension storage. Specifically, tccPreferences stores mode, width, and height; tccConsentVersion stores consent version 1 when enabled and 0 when disabled. The consent record is not associated with your name, account, or a consent timestamp. The extension does not use Chrome sync storage.

You can open Help and settings from the extension's toolbar popup and disable the features there. Disabling closes the always-on-top window managed by the extension, removes the embedded chat and added menu entry, and restores the video to its original place. A separate official Twitch chat window opened with the separate-chat button is not closed automatically. Layout preferences remain on your device. Settings normally persist through updates, but upgrades from versions without a consent record remain disabled until you agree and enable the features. Uninstalling the extension removes its local settings and consent record.

It does not save credentials, passwords, cookies, chat messages, account identifiers, channel names, or browsing history in its extension storage.

### Connections to Twitch

Displaying embedded official chat or opening its separate window connects your browser to Twitch. The channel name is included in the Twitch URL to load the correct chat. An existing Twitch session may be used. Content that you enter or send through chat, your IP address, cookies, and other service data are processed by Twitch according to its services and your browser settings. Video continues to use Twitch's existing streaming connection.

See the [Twitch Privacy Notice](https://legal.twitch.com/en/legal/privacy-notice/) for Twitch's processing, retention, deletion options, and related services. The extension does not control Twitch's processing. Because Twitch's services communicate over the network, this is not an entirely offline product.

### Developer collection and use

The extension's code contains no developer-server uploads, advertising SDKs, analytics SDKs, usage tracking, or telemetry. The developer does not receive chat message bodies or browsing history from the extension. Information handled by the extension is not sold, used for personalized advertising, or supplied for creditworthiness or lending decisions.

The extension uses information only to provide the video-and-official-chat window features, saved settings, and consent-state management described here. Its handling of user information follows the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/policies), including the Limited Use requirements.

### Permissions and website access

- storage: saves the settings described above locally on your device.
- Website access: top-level HTTPS pages matching https://www.twitch.tv/* and https://player.twitch.tv/*, to integrate with the player and display official chat.

The extension does not request permissions for browser-history lists, all-tab lists, the Cookies API, OAuth identity, microphone, camera, or screen capture. It does read the current Twitch page's URL within that page to provide its features.

### Questions and changes

Use GitHub Issues, linked above, for privacy questions about the extension. Issues are public. Do not post passwords, verification codes, or personal information. If functionality or data practices change, this policy and any required in-product disclosures will be updated.
