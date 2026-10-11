# src/CLAUDE.md

`src/` 直下(`scenes/` を除く)を触るときのガイド。シーンの実装自体は [src/scenes/CLAUDE.md](scenes/CLAUDE.md) を参照。ルートの案内は [../CLAUDE.md](../CLAUDE.md)。

操作方法・機能の説明は [../README.md](../README.md)、各機能の挙動の仕様は [../specs/](../specs/README.md) が正本。ここには実装の構成・設計判断の理由・落とし穴だけを書く。

## マルチウィンドウ構成

操作UIと、複数持てる投影窓の構成([../specs/001-multi-window-projection.md](../specs/001-multi-window-projection.md) / [../specs/003-multiple-display-windows.md](../specs/003-multiple-display-windows.md)参照)。Viteのマルチページビルド(`vite.config.ts` の `rollupOptions.input`)で `control.html` / `display.html` の2エントリをビルドする。

- **control.html + [control.ts](control.ts)** — 操作UI(UI表記は英語)。マイク解析(`AudioAnalyzer`)は全投影窓で共通の1系統のみ。「Add Display」で新規投影窓を開き、`windowId`(`crypto.randomUUID()`)を発行して `displays: Map<windowId, DisplayEntry>` で管理する。状態のsingle source of truthであり、`sceneIndexByWindow`・`paletteByWindow`・`crossfadeByWindow`・`pad`・強度・音声レベルを `BroadcastChannel` に送信する。シーンプリセットは特定の投影窓に紐づかない共有ライブラリのため、保存・削除のたびに `refreshAllPresetSelects()` で全投影窓行のselectを同期し直す。
- **display.html + [display.ts](display.ts)** — 投影窓。URLの `windowId` クエリパラメータ(`window.open` 時に付与)を読み、`BroadcastChannel` で受信した状態から自分の分(`sceneIndexByWindow[windowId]` など)を見て描画する。クロスフェードのレイヤー管理・CSSトランジション・後片付けは操作UIとは独立して自分で行う(操作UIから進捗は送られない)。
- **[shared.ts](shared.ts)** — 2画面間でやり取りする `VJState` 型、`BroadcastChannel` 名、`TICK_INTERVAL_MS` を定義する共有モジュール。

## シーン切替とクロスフェード

[specs/006-scene-crossfade.md](../specs/006-scene-crossfade.md)参照。シーン選択・パレット設定・プリセット選択は、投影窓の「予約」レイヤー(`DisplayEntry.pendingLayer`)を編集するだけで、表示への反映は「Crossfade」ボタンを押すまで起きない。

- **[layer.ts](layer.ts)** — `Layer`(1シーン分のシーンインスタンス・WebGL用canvas・専用の`THREE.WebGLRenderer`)の生成・リサイズ・描画・破棄。`createLayer()` は毎回 `sceneFactories` から新規にシーンインスタンスを生成する。**シーン切替(クロスフェードの有無を問わず)は常に新しいレイヤーを作る設計**であり、同じシーンに戻っても新しいインスタンスになる。したがってFeedback Loopのような蓄積系シーンの状態は、切り替えるたびにリセットされる(意図した割り切り。three.jsの`WebGLRenderTarget`が特定の`WebGLRenderer`に紐づくため、旧シーン用と新シーン用で別々のcanvas/rendererを使うクロスフェードと、シーンごとに状態を保持し続ける設計は両立しない)。
- **[crossfade.ts](crossfade.ts)** — `startCrossfade()`。新レイヤーを旧レイヤーに重ね、CSSの `opacity: 0 → 1` トランジションでブレンドをブラウザのコンポジタに任せる(自前のピクセル合成なし)。完了後に旧レイヤーを破棄する。control.ts・display.tsの両方から呼ばれる。
- クロスフェード実行時、`crossfadeByWindow[windowId]` に `{ id, toSceneName, toPalette, durationMs }` をセットして配信する。投影窓側は `id` が前回と変わったときだけ新規に開始する(毎tick同じ内容を送っても二重に開始しないため)。
- 操作UIの各投影窓行は `currentLayer` と `pendingLayer` を常時両方レンダリングする(Current/Nextプレビュー)。`pendingLayer` はクロスフェード実行時にそのまま遷移先レイヤーになり、同時に同内容の新しい `pendingLayer` が用意される(Next欄が空白にならないため)。コストとして、操作UI側は常に2レイヤー分のレンダリングがかかる(投影窓側はクロスフェード中だけ2レイヤー)。

## FXパッド

[specs/015-fx-pad.md](../specs/015-fx-pad.md)参照。

- `SceneContext.padX`/`padY`(共に-1〜1、中心が0)として全シーンの`render()`に渡り、シーンは `Scene.padSupported` で対応を宣言する。`VJState.pad` は `tick()` が毎回現在値をそのまま送る(減衰も「idの変化を検知して自分で計算する」方式もない。離すと0に戻るだけ)。
- `updateFxPadEnabled()` は、表示中のどの投影窓も `padSupported` でない(または投影窓が0個の)場合にだけ `#fx-pad` を無効化する。
- 座標変換は [pad.ts](pad.ts)。`#fx-pad` のサイズは `container-type: size` + `cqw`/`cqh` でアスペクト比を保って最大化している(`width:100%; aspect-ratio` だと縦長に潰れたため。理由は仕様書の実装メモ)。パッドエリアの高さは `localStorage`(`norigvj-fx-pad-section-height`)に保存する。

## 主要ファイル

- [audio.ts](audio.ts) — `AudioAnalyzer` クラス。`fftSize: 512`、`smoothingTimeConstant: 0.8` で周波数データを取得し、周波数ビンを低域0〜6%(〜1.3kHz)/中域6〜25%(〜1.3〜5.5kHz)/高域25〜100%(〜5.5〜22kHz)に分割して `volume/bass/mid/treble`(各0-1)を算出する。境界は音楽・声のエネルギーが低〜中域に集中する実態に合わせて調整済み(高域寄りに広く取りすぎると `treble` がほぼ反応しなくなる)。
- [palettes.ts](palettes.ts) — カラーパレットのプリセット(`PALETTE_PRESETS`)と `DEFAULT_PALETTE`。シーン側の `supportsPalette` は [scenes/CLAUDE.md](scenes/CLAUDE.md) を参照。
- [palette-dropdown.ts](palette-dropdown.ts) — パレット選択用の自作ドロップダウン。ネイティブ `<select>` の `<option>` は多くのブラウザでOSネイティブのポップアップとして描画され、`background` 等のCSSが開閉時に反映されないため、選ばずに配色を確認できるよう自作した(`size` 属性でインライン展開すると反映されるため、検証時に見誤りやすい)。項目は左にmain/subの色見本を並べる方式(テキストを配色で塗ると配色によって読みにくくなる)。`value`/`disabled`/`addEventListener("change", ...)` だけ `HTMLSelectElement` と同じ形にして、`control.ts` 側の変更を最小限にしている([specs/004-scene-color-palette.md](../specs/004-scene-color-palette.md)参照)。
- [presets.ts](presets.ts) / [sequence.ts](sequence.ts) — シーンプリセット・シーケンスの型と `localStorage` 読み書き。シーンは `sceneIndex` ではなくシーン名で識別する(シーンファイルの追加・並び替えで別のシーンを指す事故を避けるため)。シーケンスは同じシーンを複数ステップに登場させられるため、ステップごとに一意な `id` を持つ([specs/005-scene-presets.md](../specs/005-scene-presets.md) / [specs/013-sequence-mode.md](../specs/013-sequence-mode.md)参照)。
- [pad.ts](pad.ts) — FXパッドの座標変換の純粋関数。DOMに依存する `control.ts` から切り出して、テストできるようにしている。
- [tick-worker.ts](tick-worker.ts) — 音声解析・状態送信を駆動するtickをWorker側で刻む(理由は下記)。

## 既知の注意点

- `analyser.getByteFrequencyData()` に `Uint8Array` を渡すとTS5.5で `Uint8Array<ArrayBufferLike>` の型エラーが出るため、[audio.ts](audio.ts) 内で `as Uint8Array<ArrayBuffer>` にキャストしている。
- 投影窓フルスクリーン化などで操作窓が他ウィンドウに完全に隠れる(occluded)と、Chromeは `requestAnimationFrame` だけでなく `setInterval`/`setTimeout` も最小1秒間隔にクランプする。Worker内のタイマーはこの抑制を受けないため、[control.ts](control.ts) は音声解析・状態送信を駆動するtickを [tick-worker.ts](tick-worker.ts) に任せている。tickの間隔 `TICK_INTERVAL_MS`(33ms)は [crossfade.ts](crossfade.ts) も参照する(`durationMs=0` のクロスフェードでも、tick()に最低1回は状態を観測させるため。[specs/006-scene-crossfade.md](../specs/006-scene-crossfade.md)の実装メモ参照)。
- `hidden` 属性で要素の表示・非表示を切り替える場合、その要素(またはそのセレクタ・クラス)に `display: flex`(または `display: block` 等)を指定するCSSルールがあると、`hidden` が効かず表示されたままになる。原因はセレクタの詳細度ではなくCSSカスケードの優先順位そのもの — `[hidden] { display: none }` はUser Agentスタイルシート由来であり、通常の重要度では作者(author)のスタイルシートが詳細度に関わらず優先されるため、作者側の `display` 指定に負ける(control.htmlの `.modal-overlay`(クラスセレクタ)、`#auto-interval-section`(IDセレクタ)の両方で実際に発生した)。`hidden` で消したい要素には、その要素に対して `display: none;` を明示するルールを `[hidden]` 付きで追加すること(例: `.some-class[hidden] { display: none; }`)。
- `draggable="true"` を要素に常時付けたまま、その内部に `<input type="range">` 等のインタラクティブな子要素を置くと、そのスライダーをドラッグしようとした瞬間にブラウザが「要素自体のドラッグ開始」と誤認識し、スライダー操作ができなくなる(シーケンス編集モーダルの各ステップ行で実際に発生した)。対策として、行自体は常時 `draggable = false` にしておき、専用のドラッグハンドルの `mousedown`/`mouseup` でだけ一時的に `draggable` を切り替える(`control.ts` の `renderSequenceStepsList()` 参照)。
