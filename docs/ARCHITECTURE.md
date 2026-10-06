# 構成と設計

対象: デスクトップ版Chrome / Edge、Manifest V3。バージョン1.5.1。

## 機能と入口

1. Twitch純正ポップアウトでは、既存プレイヤーのDOMを保持して領域だけ調整し、公式チャットを追加します。
2. 通常配信ページでは、Twitchの歯車内「ポップアウト」の隣に「ポップアウト（最前面）」を追加します。ここからDocument Picture-in-Pictureへ、同じvideoと公式チャットを表示します。

最前面の入口は歯車内だけです。通常ページやポップアウトの別の場所へ起動ボタンを出しません。ブラウザやTwitchの本来の操作を上書きせず、元ウィンドウを自動で閉じません。

## 確認済みメニュー構造

利用者のElements画面で、次の構造を確認しました。

- div[data-a-target="player-settings-menu"]
- その直下の行ラッパーdiv
- button[role="menuitem"]
- div → div → 「ポップアウト」の表示文字

この限定された構造、表示状態、一意の対象を確認できた場合だけ追加します。Twitchが文書化した恒久APIではないため、構造が変わったら追加を止めます。

見た目のclassだけを参照した新しい行・ボタンを作り、元のハンドラー、data属性、ID、インラインイベントをコピーしません。既存の「ポップアウト」は変更しません。追加したボタンから直接requestWindowを呼び、ユーザー操作要件を満たします。

メニュー発見の全体監視は操作直後の短時間に限り、対象を発見したらメニューと限定した祖先の監視へ切り替えます。メニュー閉鎖、再描画、配信遷移、元動画の差し替え、ページ離脱で自分の行と監視を片付けます。

## ファイル

- manifest.json: MV3、storage、対象2ホスト、実行順
- i18n.js / _locales: ブラウザのメッセージAPI、11言語のローカル翻訳、方向指定
- core.js: URL検証、設定正規化、配置判定、公式URL生成、ヘッダー高さ
- gear-menu.js: 検証した歯車項目への限定追加と後処理
- content.js: ページ判定、純正ポップアウト調整、動画の移動/復元、設定保存
- ui.js: 小窓のヘッダー、配置ボタン、公式チャットiframe
- content.css: 純正ポップアウトの領域調整
- help.html / help.css / help.js: 状態と「使い方・設定」だけのコンパクトなポップアップ
- onboarding.html / onboarding.css / onboarding.js: 白基調の説明・同意・設定ページ
- background.js: 初回インストール時のみ説明タブを開くイベント処理

## 映像・チャット

Document PiPでは元のvideoを移します。元の親、兄弟位置、style、controlsを保持し、小窓を閉じると復元します。Twitchが別videoへ差し替え済みなら、古い動画を重複して戻しません。

公式チャットはhttps://www.twitch.tv/embed/CHANNEL/chatで、parentは元Twitchページのホスト名を指定します。iframe内のDOMや認証情報にアクセスせず、エモート・投稿・削除表示等はTwitchの公式実装に委ねます。

ヘッダーは36px、操作はAUTO / SIDE / BOTTOM / HIDE / 再読込 / 別窓です。基本ボタン高24px、上下余白は約5～6pxです。HIDEはiframeを維持して表示領域だけを畳みます。

## 保存と権限

保存はtccPreferencesのmode / width / heightとtccConsentVersionのみです。旧版の同じ設定を正規化して使います。新たな認証、ネットワークの独自取得、バックグラウンドのネットワーク処理はありません。

CSPや埋め込み制限を回避しません。純正プレイヤーの歯車と干渉し得るrootのcontain・overflow・巨大なz-index強制は使いません。

## 一次資料

- [Chrome Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)
- [Document PiP仕様](https://wicg.github.io/document-picture-in-picture/)
- [Twitch公式チャットEmbed](https://dev.twitch.tv/docs/embed/chat/)
- [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Twitchのチャンネルページ案内](https://help.twitch.tv/s/article/a-tour-of-your-channel-page)

歯車項目の具体的なDOMアンカーは公開API文書ではなく、提供された実画面のElements表示に基づきます。

## 多言語

翻訳はすべて拡張内に同梱し、chrome.i18nで同期取得します。ネットワーク翻訳、外部コード、翻訳のための追加権限はありません。ブラウザのUI言語とTwitch側の表示言語は一致する必要がありません。ネイティブ項目の照合は、検証された公式ラベル集合と同じ厳格な構造で行います。

アラビア語は説明・通知・独自ボタンの読み方向をRTLにします。配置は物理方向の意味を維持し、SIDEは右側、ヘッダーとAUTO/SIDE/BOTTOM/HIDEは左からの固定順です。TwitchのdocumentElementや既存メニュー属性は変更しません。

## 配布物

実行用ZIPはmanifest.json直下で、実行に必要なローカルJS/CSS/HTML/翻訳/独自アイコンだけです。ソースZIPにテスト、導入説明、設計、プライバシー情報、再現可能なパッケージスクリプトを含めます。依存パッケージ・秘密情報・取得した外部JS・個人のスクリーンショットは同梱しません。

## 初回同意

説明タブの明示ボタンでtccConsentVersionを1にしてから、対象ページを判定し、動画/メニュー/チャットへアクセスします。欠落・未知の値・保存読出しエラーは無効のままです。旧設定からの暗黙同意はありません。無効化は0を保存し、storage.onChangedで小窓復元・表示解除・監視/タイマー解除を行います。

初期の非同期読出しは世代番号を照合し、後から来た無効化を古い同意値で上書きしません。保留中の小窓要求もライフサイクル世代で無効化します。永続離脱時はstorageのリスナーを解除し、BFCache中は再初期化を抑制します。

## インストール導線

manifestのoptions_uiはonboarding.htmlをopen_in_tab:trueで登録します。runtime.onInstalledのreasonがinstallのときだけruntime.openOptionsPageを呼び、updateやchrome_update、起動時には開きません。ツールバーのポップアップからも同じAPIで自分の設定ページを再表示します。ブラウザが既存ページへのフォーカスを扱い、ページを再読み込みしません。閲覧タブ一覧の取得・tabs権限・追加保存キーは不要です。

説明ページの「今はしない」は状態を保存せず、そのページ内に無効のままである旨を表示します。どのタブで設定を変えてもstorage.onChangedで状態を更新し、古い保存/読出しコールバックは世代番号で無効化します。

一次資料: [Chrome Tabsの初回案内例](https://developer.chrome.com/docs/extensions/reference/api/tabs#open_an_extension_page_in_a_new_tab)、[runtime.openOptionsPage](https://developer.chrome.com/docs/extensions/reference/api/runtime#method-openOptionsPage)、[options_ui](https://developer.chrome.com/docs/extensions/develop/ui/options-page)。
