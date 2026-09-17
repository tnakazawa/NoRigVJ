# 014: Auto mode状態表示・Trigger見出し・ヘルプアイコン

- ステータス: Implemented
- 作成日: 2026-09-17

## 背景・目的

コントロールパネルの操作項目が増え、見た目だけでは現在の設定状態や各項目の意味が分かりにくくなってきた。以下の3点で操作性・可読性を改善する。

- Auto modeが現在ON/OFFのどちらで、Random/Sequenceのどちらの方式かを一目で確認できるようにする。
- Trigger 1/2/3のボタン群に見出しを付け、他のセクションと同じ見た目の一貫性を持たせる。
- 各コントロールの意味を、画面を離れずにその場で確認できるようにする。

## 要件

- 「Auto mode」の見出しの右に、現在の状態を `(ON / Random)` のような形式で表示する。ON/OFFは`fullAutoEnabled`、Random/Sequenceは`autoMode`をそのまま反映し、両者が変化するたびリアルタイムに更新する。
- Trigger 1/2/3ボタンの上に「Trigger」という見出しを追加する(Auto mode等、他のセクションと同じ見た目)。
- コントロールパネルの主要な項目(Intensity、Crossfade duration、Random、Auto mode、Auto interval、Autoトグル、Trigger、Enable Mic、Add Display)それぞれの右に「?」アイコンボタンを設置する。
  - クリックすると、その項目のタイトルと説明文を表示するモーダル(シーケンス編集モーダルと同じ`.modal-overlay`/`.modal`の見た目)が開く。
  - モーダル右上の「✕」ボタン、またはモーダル外側(オーバーレイ部分)のクリックで閉じる(投影窓の削除ボタンと同じ`.close-btn`の見た目にし、目立たせすぎない)。
  - 説明文は英語で統一する(既存UIラベルが英語のため)。

## 非機能要件

- 特になし。既存のパネルの見た目(色・余白)に合わせる。

## 受け入れ基準

- [x] Auto modeの見出し右に現在の状態(ON/OFF・Random/Sequence)が表示され、Autoトグルやモード切替に応じて即座に更新される
- [x] Trigger 1/2/3ボタンの上に「Trigger」という見出しが表示される
- [x] 主要な項目の右に「?」ボタンがあり、クリックするとその項目のタイトル・説明文を表示するモーダルが開く
- [x] モーダル右上の「✕」ボタン、またはモーダル外側のクリックで閉じる
- [x] 説明文は英語で表示される

## 実装メモ

`control.html`の各セクション見出し行を`.section-header`(flex, 右端に「?」ボタン)でラップした。各「?」ボタンは`data-help-title`(タイトル)・`data-help`(説明文、英語)属性に内容を持たせるだけで、個別のポップオーバー要素は持たない。共通の`#help-modal`(`sequence-modal`と同じ`.modal-overlay`/`.modal`構造、`.help-modal`クラスで横幅・右上の`.close-btn`用の余白を調整)を1つ用意し、`src/control.ts`側は`.help-btn`のクリックで`event.currentTarget`の`dataset.helpTitle`/`dataset.help`を`#help-modal-title`/`#help-modal-text`に流し込んで`hidden = false`にするだけの汎用ロジックにしている。閉じるボタンは投影窓の削除ボタンと同じ`.close-btn`(丸型・右上absolute配置)を流用し、テキストの「Close」ではなく「✕」アイコンにして目立ちすぎないようにした。閉じるのは`.close-btn`のクリックと、オーバーレイ自身(`event.target === helpModal`)のクリックの両方(`sequence-modal`は「Close」ボタンのみで閉じるが、ヘルプは開閉頻度が高いためオーバーレイクリックでも閉じられるようにした)。

Auto modeの状態表示(`#auto-mode-status`)は、既存の`updateAutoToggleLabel(now)`(`tick()`から33ms間隔で呼ばれている)に1行追加する形にした。専用の更新関数を新設せず、既にfullAutoEnabled/autoModeの変化を毎フレーム反映している箇所に相乗りしている。

ヘルプの説明文はすべて英語で記述した(既存のUIラベル自体が英語のため、統一性を優先)。
