# src/CLAUDE.md

`src/` 直下(`scenes/` を除く)を触るときのガイド。シーンの実装自体は [src/scenes/CLAUDE.md](scenes/CLAUDE.md) を参照。ルートの案内は [../CLAUDE.md](../CLAUDE.md)。

## マルチウィンドウ構成

操作UIと、複数持てる投影窓の構成([../specs/001-multi-window-projection.md](../specs/001-multi-window-projection.md) / [../specs/003-multiple-display-windows.md](../specs/003-multiple-display-windows.md)参照)。Viteのマルチページビルド(`vite.config.ts` の `rollupOptions.input`)で `control.html` / `display.html` の2エントリをビルドする。

- **control.html + [control.ts](control.ts)** — 操作UI。マイク解析(`AudioAnalyzer`)は全投影窓で共通の1系統のみ。「投影窓を追加」ボタンを押すたびに新規投影窓を開き、`windowId`(`crypto.randomUUID()`)を発行して `displays: Map<windowId, DisplayEntry>` で管理する。各投影窓ごとに独立したプレビューcanvas・シーンインスタンス・シーン選択(`<select>`)・カラーパレット設定・「閉じる」ボタンを持つ一覧UIになっている。状態のsingle source of truthであり、`sceneIndexByWindow`(windowId → sceneIndex)・`paletteByWindow`(windowId → Palette)・強度・音声レベルを `BroadcastChannel` に送信する。
- **display.html + [display.ts](display.ts)** — 投影窓。起動時にURLの `windowId` クエリパラメータ(`window.open` 時に付与される)を読み取り、`BroadcastChannel` で受信した状態から `sceneIndexByWindow[windowId]` / `paletteByWindow[windowId]` だけを見て描画するステートレスなレンダラー。`F` キーでFullscreen API切り替え。
- **[shared.ts](shared.ts)** — 2画面間でやり取りする `VJState`(`sceneIndexByWindow` / `paletteByWindow` を含む)型と `BroadcastChannel` 名を定義する共有モジュール。

## 主要ファイル

- [audio.ts](audio.ts) — `AudioAnalyzer` クラス。`fftSize: 512`、`smoothingTimeConstant: 0.8` で周波数データを取得し、周波数ビンを低域0〜6%(〜1.3kHz)/中域6〜25%(〜1.3〜5.5kHz)/高域25〜100%(〜5.5〜22kHz)に分割して `volume/bass/mid/treble`(各0-1)を算出する。境界は音楽・声のエネルギーが低〜中域に集中する実態に合わせて調整済み(高域寄りに広く取りすぎると `treble` がほぼ反応しなくなる)。
- [palettes.ts](palettes.ts) — カラーパレットのプリセット定義(`PALETTE_PRESETS`)とデフォルトパレット(`DEFAULT_PALETTE`)。シーン側の `supportsPalette` については [scenes/CLAUDE.md](scenes/CLAUDE.md) を参照。
- [tick-worker.ts](tick-worker.ts) — 音声解析・状態送信を駆動するtickをWorker側で刻む(理由は下記既知の注意点参照)。

## 既知の注意点

- `analyser.getByteFrequencyData()` に `Uint8Array` を渡すとTS5.5で `Uint8Array<ArrayBufferLike>` の型エラーが出るため、[audio.ts](audio.ts) 内で `as Uint8Array<ArrayBuffer>` にキャストしている。
- 操作UI・投影窓とも、2D用/WebGL用の2枚のcanvasを重ねて配置し、アクティブなシーンの `kind` に応じて `display: none` で表示を切り替えている。`display: none` の間はそのcanvasの `clientWidth/clientHeight` が0になるため、シーン切替時は表示状態を変えた直後に必ずリサイズ処理(`resize()`)を呼び直す必要がある(呼ばないとWebGL側の内部解像度が0のままになり描画されない)。
- 投影窓フルスクリーン化などで操作窓が他ウィンドウに完全に隠れる(occluded)と、Chromeは隠れたウィンドウの `requestAnimationFrame` だけでなく `setInterval`/`setTimeout` も最小1秒間隔にクランプする。Worker内のタイマーはこの抑制を受けないため、[control.ts](control.ts) は音声解析・状態送信を駆動するtickのタイミングを [tick-worker.ts](tick-worker.ts) に任せている。

## 操作方法(control.html)

| キー / UI | 動作 |
|---|---|
| Space / マイクボタン | マイク入力を有効化(全投影窓共通) |
| ← / → / スライダー | エフェクトの強度を調整(0〜3、全投影窓共通) |
| 投影窓ごとのセレクトボックス | その投影窓に表示するシーンを個別に切り替え |
| 投影窓ごとのパレットUI | プリセット選択 / メイン・サブのカラーピッカーで配色を個別に設定([../specs/004-scene-color-palette.md](../specs/004-scene-color-palette.md)参照) |

数字キーによるシーン切替は廃止済み(投影窓ごとにシーンが異なりうるため、「どの窓に効くか」が曖昧になるのを避けている)。投影窓側では `F` キーでフルスクリーン切り替え。
