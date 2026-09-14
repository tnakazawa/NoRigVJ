# src/CLAUDE.md

`src/` 直下(`scenes/` を除く)を触るときのガイド。シーンの実装自体は [src/scenes/CLAUDE.md](scenes/CLAUDE.md) を参照。ルートの案内は [../CLAUDE.md](../CLAUDE.md)。

## マルチウィンドウ構成

操作UIと、複数持てる投影窓の構成([../specs/001-multi-window-projection.md](../specs/001-multi-window-projection.md) / [../specs/003-multiple-display-windows.md](../specs/003-multiple-display-windows.md)参照)。Viteのマルチページビルド(`vite.config.ts` の `rollupOptions.input`)で `control.html` / `display.html` の2エントリをビルドする。

- **control.html + [control.ts](control.ts)** — 操作UI(UI表記は英語)。マイク解析(`AudioAnalyzer`)は全投影窓で共通の1系統のみ。「Add Display」ボタンを押すたびに新規投影窓を開き、`windowId`(`crypto.randomUUID()`)を発行して `displays: Map<windowId, DisplayEntry>` で管理する。各投影窓ごとに独立したプレビュー・シーン選択(`<select>`)・カラーパレット設定・シーンプリセットの保存/呼び出し/削除・「Crossfade」ボタンを持つ一覧UIになっている(投影窓を閉じる操作は行右上の「✕」ボタンで行う)。状態のsingle source of truthであり、`sceneIndexByWindow`(windowId → sceneIndex)・`paletteByWindow`(windowId → Palette)・`crossfadeByWindow`・強度・音声レベルを `BroadcastChannel` に送信する。プリセットの保存・削除操作は `refreshAllPresetSelects()` で画面上の全投影窓行のプリセットselectを同期し直す(プリセットは特定の投影窓に紐づかない共有ライブラリのため)。
- **display.html + [display.ts](display.ts)** — 投影窓。起動時にURLの `windowId` クエリパラメータ(`window.open` 時に付与される)を読み取り、`BroadcastChannel` で受信した状態から `sceneIndexByWindow[windowId]` / `paletteByWindow[windowId]` / `crossfadeByWindow[windowId]` を見て描画する。操作UIとは独立して自分自身でクロスフェードのレイヤー管理・CSSトランジション・完了後の後片付けを行う(操作UI側から進捗を都度送っているわけではない)。`F` キーでFullscreen API切り替え。
- **[shared.ts](shared.ts)** — 2画面間でやり取りする `VJState`(`sceneIndexByWindow` / `paletteByWindow` / `crossfadeByWindow` を含む)型と `BroadcastChannel` 名を定義する共有モジュール。

## シーン切替とクロスフェード

[specs/006-scene-crossfade.md](../specs/006-scene-crossfade.md)参照。シーン選択・パレット設定・プリセット選択は、投影窓の「予約」レイヤー(`DisplayEntry.pendingLayer`)を編集するだけで、表示への反映は「Crossfade」ボタンを押すまで起きない。

- **[layer.ts](layer.ts)** — `Layer`(1シーン分のレンダリング一式: シーンインスタンス・WebGL用canvas・専用の`THREE.WebGLRenderer`)を生成・リサイズ・描画・破棄するための共通モジュール(全シーンWebGLのため、canvasは1枚のみ。[specs/009-webgl-only-scenes.md](../specs/009-webgl-only-scenes.md)参照)。`createLayer()` は毎回 `sceneFactories` から新規にシーンインスタンスを生成する。**シーン切替(クロスフェードの有無を問わず)は常に新しいレイヤーを生成する設計**であり、同じシーンに戻ってきても新しいインスタンスになる。したがってFeedback Loopのような蓄積系シーンの状態は、シーンを切り替えるたびにリセットされる(意図した割り切り。理由はthree.jsの`WebGLRenderTarget`が特定の`WebGLRenderer`に紐づくため、旧シーン用と新シーン用で別々のcanvas/rendererを使うクロスフェードと、「シーンごとに状態を保持し続ける」設計は両立しない)。
- **[crossfade.ts](crossfade.ts)** — `startCrossfade()`。新レイヤーを旧レイヤーに重ねてDOMに追加し、CSSの `opacity: 0 → 1` トランジションで見た目のブレンドをブラウザのコンポジタに任せる(自前のピクセル合成は行わない)。トランジション中は旧・新レイヤー両方を毎フレームレンダリングし続け、完了後に旧レイヤーを破棄する。control.ts・display.tsの両方から呼ばれる。
- クロスフェード実行時、`crossfadeByWindow[windowId]` に `{ id, toSceneName, toPalette, durationMs }` をセットして配信する。`id` は発生ごとに一意の値で、投影窓側はこの `id` が前回と変わったときだけ新しいクロスフェードを開始する(同じ内容を毎tick送り続けても二重に開始しないようにするため)。
- 操作UIの各投影窓行は `currentLayer`(現在)と `pendingLayer`(次への予約)を常時両方保持・レンダリングし、「Current」「Next」のプレビューを並べて表示する。各投影窓行はプレビュー(`.preview-group`)を上、コントロール類(`.display-row-controls`)を下に配置するレイアウト(縦積み)で、コントロール類はさらに「シーン選択+カラー選択+Crossfade」「プリセット保存/呼び出し/削除」の2行(`.control-row` / `.preset-row`)に分けている。「✕」(閉じる)ボタンだけは行の右上に絶対配置(`.close-btn`)にして、コントロール一覧から独立させている。`#displays-list` は `flex-wrap: wrap` で、画面が広ければ投影窓行が2列に並ぶ(`.display-row` に `max-width: calc(50% - 6px)`)。Current/Nextプレビューは固定pxではなく `.preview-slot` の `flex` 比率(`current-slot: 1`、`pending-slot: 0.63`)で幅を分配しており、行の幅に追従してはみ出さない。「Add Display」「Enable Mic」ボタンはパネル(`#panel`)の下端に固定表示している(`.panel-footer` に `margin-top: auto`)。`pendingLayer` はクロスフェード実行時にそのまま遷移先レイヤーとして使われ(予約プレビュー用とクロスフェードのtoレイヤーを同一インスタンスに統合)、実行と同時に同じ内容の新しい `pendingLayer` が用意される(「Next」欄が空白にならないようにするため)。この設計により、操作UI側は常時2レイヤー分のレンダリングコストがかかる(投影窓側は変わらず、実際のクロスフェード中だけ2レイヤーになる)。

## 手動トリガー演出

[specs/007-manual-trigger.md](../specs/007-manual-trigger.md)参照。以前試みたBPM自動検出は精度不足で撤回し、代わりにVJ本人がボタン/キーで発火するワンショット演出にした。

- `SceneContextBase.triggers: [number, number, number]` がTrigger 1/2/3それぞれの発生状況(発生時1→指数減衰)を全シーンの `render()` に渡す。`Scene2D`/`SceneWebGL` の `triggerEffectNames?: TriggerEffectNames` に、対応する演出があるインデックスだけ名前を入れる(未対応は `undefined`)。シーンは0〜3個の任意個数だけ対応してよい。現時点の対応シーンはPulse Rings・Noise Fieldの2つのみ。
- `VJState.trigger: { id, index } | null` で伝搬する。`id` はクロスフェードの `CrossfadeInstruction.id` と同じ考え方で、発生ごとに一意にし、投影窓側はこの `id` が変わったときだけ新規発生とみなす。実際の減衰値(`triggers` の3要素)は操作UI側・投影窓側それぞれが自分の内部状態(各トリガーを最後に検知した時刻)から計算する(`computeTriggers()`、control.ts/display.ts双方に同じ実装を持つ)。
- パネルの「Trigger 1/2/3」ボタンは、表示中の投影窓のいずれかがそのトリガーに対応していなければ無効化する(`updateTriggerButtonStates()`)。

## 主要ファイル

- [audio.ts](audio.ts) — `AudioAnalyzer` クラス。`fftSize: 512`、`smoothingTimeConstant: 0.8` で周波数データを取得し、周波数ビンを低域0〜6%(〜1.3kHz)/中域6〜25%(〜1.3〜5.5kHz)/高域25〜100%(〜5.5〜22kHz)に分割して `volume/bass/mid/treble`(各0-1)を算出する。境界は音楽・声のエネルギーが低〜中域に集中する実態に合わせて調整済み(高域寄りに広く取りすぎると `treble` がほぼ反応しなくなる)。
- [palettes.ts](palettes.ts) — カラーパレットのプリセット定義(`PALETTE_PRESETS`、32色)とデフォルトパレット(`DEFAULT_PALETTE`)。シーン側の `supportsPalette` については [scenes/CLAUDE.md](scenes/CLAUDE.md) を参照。
- [palette-dropdown.ts](palette-dropdown.ts) — パレットプリセット選択用の自作ドロップダウン(`createPaletteDropdown()`)。ネイティブ `<select>` の `<option>` は多くのブラウザでOSネイティブのポップアップメニューとして描画され、`background` 等のCSSが実際の開閉時には反映されないため(`size` 属性でインライン展開した場合は通常のDOM描画になり反映されるため、検証時に見誤りやすい)、選ばずに配色を確認できるようにするには自作するしかなかった。各項目はテキストを配色で塗らず、左にmain/subの小さな色見本(`.palette-swatch`)を2つ並べる方式にしている(全面着色だと配色によって文字が読みにくくなるため)。`value`/`disabled`/`addEventListener("change", ...)` だけ `HTMLSelectElement` と同じ形にして、`control.ts` 側の変更を最小限にしている([specs/004-scene-color-palette.md](../specs/004-scene-color-palette.md)参照)。
- [presets.ts](presets.ts) — 投影窓の「シーン名 + パレット」をユーザーが名前付きで保存する `ScenePreset` の型と `localStorage` 読み書き(`loadPresets` / `savePreset` / `deletePreset`)。シーンは `sceneIndex` ではなくシーン名で識別している(シーンファイルの追加・並び替えで既存プリセットが別のシーンを指す事故を避けるため)。保存ダイアログのデフォルト名は `${シーン名}-${メインカラー}-${サブカラー}`([control.ts](control.ts)側で組み立てる)。[specs/005-scene-presets.md](../specs/005-scene-presets.md)参照。
- [tick-worker.ts](tick-worker.ts) — 音声解析・状態送信を駆動するtickをWorker側で刻む(理由は下記既知の注意点参照)。

## 既知の注意点

- `analyser.getByteFrequencyData()` に `Uint8Array` を渡すとTS5.5で `Uint8Array<ArrayBufferLike>` の型エラーが出るため、[audio.ts](audio.ts) 内で `as Uint8Array<ArrayBuffer>` にキャストしている。
- 投影窓フルスクリーン化などで操作窓が他ウィンドウに完全に隠れる(occluded)と、Chromeは隠れたウィンドウの `requestAnimationFrame` だけでなく `setInterval`/`setTimeout` も最小1秒間隔にクランプする。Worker内のタイマーはこの抑制を受けないため、[control.ts](control.ts) は音声解析・状態送信を駆動するtickのタイミングを [tick-worker.ts](tick-worker.ts) に任せている。

## 操作方法(control.html)

UI表記は英語。

| キー / UI | 動作 |
|---|---|
| Space / 「Enable Mic」/「Disable Mic」ボタン | マイク入力の有効・無効を切り替える(全投影窓共通)。無効化すると `AudioAnalyzer.stop()` でストリーム・`AudioContext` を解放する |
| ← / → / 「Intensity」スライダー | エフェクトの強度を調整(0〜9、全投影窓共通) |
| 「Crossfade duration」スライダー | シーン切替の遷移時間を調整(全投影窓共通) |
| 投影窓ごとのセレクトボックス | 次に切り替えるシーンを予約(即座には反映されない) |
| 投影窓ごとのパレットUI | プリセット選択 / メイン・サブのカラーピッカーで次に切り替える配色を予約([../specs/004-scene-color-palette.md](../specs/004-scene-color-palette.md)参照) |
| 投影窓ごとのシーンプリセットUI(「Save Preset」/選択/「Delete」) | 現在のシーン名+パレットを名前付きで保存/削除。呼び出すと予約に反映される。`localStorage` に永続化され、全投影窓行で共有される([../specs/005-scene-presets.md](../specs/005-scene-presets.md)参照) |
| 投影窓ごとの「Crossfade」ボタン | 予約内容が現在の表示と異なる間のみ有効。押すと現在の表示から予約内容へクロスフェードする([../specs/006-scene-crossfade.md](../specs/006-scene-crossfade.md)参照) |
| `1`/`2`/`3` キー、「Trigger 1/2/3」ボタン | 手動トリガー演出を発火(全投影窓共通)。対応するシーンが1つも表示されていなければボタンは無効([../specs/007-manual-trigger.md](../specs/007-manual-trigger.md)参照) |

数字キーによるシーン切替は廃止済み(投影窓ごとにシーンが異なりうるため、「どの窓に効くか」が曖昧になるのを避けている)。投影窓側では `F` キーでフルスクリーン切り替え。
