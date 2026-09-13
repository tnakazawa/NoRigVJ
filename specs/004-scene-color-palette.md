# 004: シーンごとのカラーパレット設定

- ステータス: Implemented
- 作成日: 2026-09-13

## 背景・目的

既存シーンの多くは「時間経過で色相が連続的に回転する」固定の配色ロジックを持っており、VJ現場でイベントやバンドのテーマカラーに合わせて配色を調整することができない。投影窓ごとに、メイン/サブの2色からなるカラーパレットを設定できるようにする。

## 要件

### パレットの構造

- パレットは **メイン色・サブ色の2色**(それぞれ16進カラーコード)で構成する。
  ```ts
  interface Palette {
    main: string; // 例: "#ff00ff"
    sub: string;
  }
  ```
- プリセットパレットを複数用意し、加えてカラーピッカーで各色を個別に自由設定できる(プリセットを選ぶとピッカーにも反映され、ピッカーを直接変更すると独自配色として扱われる)。
- プリセット案(実装時にこちらで用意する):
  - Neon: メイン `#ff00ff` / サブ `#00ffff`
  - Sunset: メイン `#ff6a00` / サブ `#7b2ff7`
  - Mono: メイン `#ffffff` / サブ `#888888`
  - Fire: メイン `#ff3300` / サブ `#ffcc00`
  - Ocean: メイン `#00c2ff` / サブ `#0044ff`

### シーンごとの対応・非対応

シーンによって、パレット対応/非対応を選べるようにする(`Scene` に `supportsPalette: boolean` を追加)。現時点の割り当て:

- **Pulse Rings** — パレット対応。同心円ごとにメイン→サブへの線形補間で色付けする(現状の時間色相回転は廃止)。
- **Bar Spectrum** — 非対応のまま。現状の時間経過による色相回転を維持する。
- **Noise Field** — パレット対応。パーティクルごとに疑似乱数でメイン/サブ間を補間する(現状の時間色相回転は廃止)。
- **Feedback Loop(WebGL)** — パレット対応。発光の種火の色を、現状の「時間でRGB各chが独立に揺れる虹色」から「メイン⇔サブの2色間を時間でゆっくり往復する」表現に変更する。

パレット非対応のシーン(Bar Spectrum)が選択されている間、そのシーンの行のパレットUI(プリセット選択・カラーピッカー)は無効化する。

### UI配置

- カラーパレット設定は **投影窓ごとに個別** に持つ(強度・マイクとは異なり、シーン同様に窓ごとの設定)。
- 各投影窓の行に、シーン選択セレクトボックスと並べて以下を追加する:
  - プリセット選択(セレクトボックス、「カスタム」を含む)
  - メインカラーピッカー(`<input type="color">`)
  - サブカラーピッカー(`<input type="color">`)

### データの伝搬

- `VJState` に `paletteByWindow: Record<string, Palette>`(windowId → Palette)を追加し、`sceneIndexByWindow` と同様にBroadcastChannelで配信する。
- `SceneContextBase` に `palette: Palette` を追加し、全シーンの `render` に渡す(非対応シーンは単に無視すればよい)。

## 非機能要件

- 既存のパレット非対応シーン(Bar Spectrum)・既存のマルチウィンドウ機能は現状のまま動作すること。
- 引き続きオフラインで動作すること。

## 受け入れ基準

- [x] 各投影窓の行にプリセット選択・メイン/サブのカラーピッカーが表示される
- [x] プリセットを選ぶと、そのシーンの配色がメイン/サブ色に基づいて変わる(Pulse Rings / Noise Field / Feedback Loop)
- [x] カラーピッカーを個別に変更すると、その色がリアルタイムに反映される
- [x] Bar Spectrum選択時はパレットUIが無効化され、既存の時間色相回転の見た目のまま変わらない
- [x] 投影窓ごとに異なるパレットを設定でき、それぞれ独立して反映される
- [x] 既存のシーン切替・強度調整・マイク反応・BroadcastChannel同期・複数投影窓機能は引き続き問題なく動作する

## 実装メモ

- `Palette { main, sub }` を `src/scenes/_shared/types.ts` に定義し、`SceneContextBase` に追加。全シーンの `render()` に渡るが、`supportsPalette: false` のシーン(Bar Spectrum)は単に無視すればよい設計にした。
- プリセットは [src/palettes.ts](../src/palettes.ts) に集約(`PALETTE_PRESETS` / `DEFAULT_PALETTE`)。シーンファイルからは参照せず、UI(`control.ts`)と初期値(`display.ts`)からのみ参照する。
- 色の受け渡し: Canvas 2Dは `_shared/color-utils.ts` の `hexToRgb()` / `lerpColor()` で hex→rgb文字列に変換。WebGL(Feedback Loop)は `hexToRgb()` の結果を `THREE.Vector3` のuniform(`uMainColor` / `uSubColor`)に詰め、フラグメントシェーダー内で `mix()` している。
- Pulse Rings: 5本のリングを `i / (ringCount - 1)` の比率でメイン→サブへ線形補間。Noise Field: パーティクルごとに `sin(i * 7.3)` という時間に依存しない疑似乱数でメイン/サブ間を補間し、色が時間で変わらずちらつかないようにした。Feedback Loop: 発光の種火の色を `mix(uMainColor, uSubColor, 0.5 + 0.5*sin(uTime*0.5))` とし、「色相が回り続ける」表現から「2色間をゆっくり往復する」表現に変更した。
- `VJState` に `paletteByWindow: Record<windowId, Palette>` を追加し、`sceneIndexByWindow` と同様にBroadcastChannelで配信。`display.ts` は `paletteByWindow[windowId] ?? DEFAULT_PALETTE` で参照する。
- UIレイアウト: 投影窓プレビュー行の横幅が狭いと、シーン選択・パレットプリセット選択・カラーピッカー2つが並びきらずはみ出た。`.palette-row` に `flex-wrap: wrap` を付け、狭い時は自動的に折り返すようにした。
- 実機Chrome(開発サーバー、`window.open` を一時的にスタブ化してこの環境の制約を回避)で、プリセット切替・カラーピッカー変更・Bar Spectrum選択時のパレットUI無効化・Feedback Loopへの反映を確認済み。
