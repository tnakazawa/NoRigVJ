# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

NoRigVJ: ブラウザ+オフラインで動作するインタラクティブなVJ(Visual Jockey)アプリケーション。マイク入力の音声を解析し、リアルタイムでビジュアルを生成する。特別なオーディオインターフェースやMIDI機材を必要としない点がコンセプト。

## コマンド

```bash
npm install       # 依存インストール
npm run dev       # 開発サーバ起動(通常 http://localhost:5173)
npm run build     # tsc -b (型チェック) → vite build
npm run preview   # ビルド成果物のプレビュー
npx tsc --noEmit  # 型チェックのみ実行
```

テストは未整備。単体テストコマンドなし。

## 開発フロー(仕様駆動開発)

ユーザー体験に関わる機能追加・変更や、複数ファイルにまたがる設計判断を伴う変更は、実装前に [specs/](specs/README.md) 配下へ仕様書を作成し合意を得てから着手する。詳細は [specs/README.md](specs/README.md) を参照。タイポ修正など軽微な変更には不要。

**実装を変更したら、影響するドキュメントを同じタイミングで必ず更新する。** 具体的には:

- 該当する `specs/*.md` — 受け入れ基準のチェック、実装メモ、ステータス(Draft/Approved/Implemented)
- [README.md](README.md) — セットアップ手順・機能一覧・シーン一覧・操作方法など、ユーザー向けの説明が実装とズレていないか
- この `CLAUDE.md` — アーキテクチャ・主要ファイル・シーン追加手順・既知の注意点・操作方法の表など

ドキュメントが実装から乖離すると、後続の開発判断(このファイルを読む次のセッション含む)を誤らせる。「動くようになった」で終わらせず、関連ドキュメントの更新までを実装の一部とする。

## アーキテクチャ

- レンダリングは **Canvas 2D API** と **WebGL(three.js)** の併存構成([specs/002-webgl-scenes.md](specs/002-webgl-scenes.md)参照)。シーンごとにどちらか一方を使う。
- **Web Audio API** で音声解析(`getUserMedia` でマイク入力)。
- フレームワーク・UIライブラリなし。依存は `vite` / `typescript` / `three` のみ。

### マルチウィンドウ構成

操作UIと、複数持てる投影窓の構成([specs/001-multi-window-projection.md](specs/001-multi-window-projection.md) / [specs/003-multiple-display-windows.md](specs/003-multiple-display-windows.md)参照)。Viteのマルチページビルド(`vite.config.ts` の `rollupOptions.input`)で `control.html` / `display.html` の2エントリをビルドする。

- **control.html + [src/control.ts](src/control.ts)** — 操作UI。マイク解析(`AudioAnalyzer`)は全投影窓で共通の1系統のみ。「投影窓を追加」ボタンを押すたびに新規投影窓を開き、`windowId`(`crypto.randomUUID()`)を発行して `displays: Map<windowId, DisplayEntry>` で管理する。各投影窓ごとに独立したプレビューcanvas・シーンインスタンス・シーン選択(`<select>`)・カラーパレット設定・「閉じる」ボタンを持つ一覧UIになっている。状態のsingle source of truthであり、`sceneIndexByWindow`(windowId → sceneIndex)・`paletteByWindow`(windowId → Palette)・強度・音声レベルを `BroadcastChannel` に送信する。
- **display.html + [src/display.ts](src/display.ts)** — 投影窓。起動時にURLの `windowId` クエリパラメータ(`window.open` 時に付与される)を読み取り、`BroadcastChannel` で受信した状態から `sceneIndexByWindow[windowId]` / `paletteByWindow[windowId]` だけを見て描画するステートレスなレンダラー。`F` キーでFullscreen API切り替え。
- **[src/shared.ts](src/shared.ts)** — 2画面間でやり取りする `VJState`(`sceneIndexByWindow` / `paletteByWindow` を含む)型と `BroadcastChannel` 名を定義する共有モジュール。

### 主要ファイル

- [src/audio.ts](src/audio.ts) — `AudioAnalyzer` クラス。`fftSize: 512`、`smoothingTimeConstant: 0.8` で周波数データを取得し、周波数ビンを低域0〜10%/中域10〜50%/高域50〜100%に分割して `volume/bass/mid/treble`(各0-1)を算出する。
- [src/palettes.ts](src/palettes.ts) — カラーパレットのプリセット定義(`PALETTE_PRESETS`)とデフォルトパレット(`DEFAULT_PALETTE`)。
- [src/scenes/](src/scenes/) — ビジュアルシーン群。1シーン1ファイルで、ビルド時に自動収集される([シーン追加の手順](#シーン追加の手順)参照)。
  - [src/scenes/_shared/types.ts](src/scenes/_shared/types.ts) — `Palette` / `Scene2D` / `SceneWebGL` / `Scene`(Union型)/ `SceneFactory` などの型定義。
  - [src/scenes/_shared/color-utils.ts](src/scenes/_shared/color-utils.ts) — `hsl()`(非パレット対応シーン用)、`hexToRgb()` / `lerpColor()`(パレット対応シーン用)などの色ヘルパー。
  - [src/scenes/index.ts](src/scenes/index.ts) — `import.meta.glob` で `src/scenes/*.ts`(`_shared/` を除く)を自動収集し、`sceneFactories: SceneFactory[]` をexportする。
  - 実装済みシーン: `01-pulse-rings.ts` / `03-noise-field.ts`(Canvas 2D、パレット対応) / `02-bar-spectrum.ts`(Canvas 2D、パレット非対応・時間経過で色相が回る) / `04-feedback-loop.ts`(WebGL、three.jsによるRenderTargetのピンポンでフィードバックループを表現、パレット対応)。

### シーン追加の手順

1. `src/scenes/NN-scene-name.ts` を作成する。`NN` は既存ファイルの最大値+1(2桁連番)。この連番がシーンの並び順・キー割当(1, 2, 3...)を決める。
2. `SceneFactory`(`() => Scene`)を `default export` する。**シーンオブジェクトを直接exportしない**こと — 操作UIのプレビューと投影窓はそれぞれ別canvas/別WebGLコンテキストを持つため、ページごとに独立したインスタンスをファクトリから生成する設計になっている。
3. Canvas 2Dシーンは `kind: "2d"`、`render(ctx: SceneContext2D)` を実装する(`ctx.audio.volume/bass/mid/treble` と `ctx.time` を使う)。
4. WebGLシーンは `kind: "webgl"`、`render(ctx: SceneContextWebGL)` を実装する。シェーダーコンパイル・`WebGLRenderTarget` 確保など初回のみでよい処理は `init?(ctx)` に書く(シーンごとに一度だけ呼ばれる)。`04-feedback-loop.ts` を参考にする。
5. `supportsPalette: boolean` を指定する。`true` なら `ctx.palette.main` / `ctx.palette.sub`(16進カラーコード)を使って配色する。`false` なら投影窓行のパレットUIが無効化され、`palette` は渡されるが無視してよい(独自の配色ロジック・時間経過での色相変化などをそのまま使える)。
6. ファイルを置くだけで `sceneFactories` に自動的に反映され、各投影窓行のシーン選択セレクトボックスの選択肢として自動的に追加される。`src/scenes/index.ts` の編集は不要。

### 既知の注意点

- `analyser.getByteFrequencyData()` に `Uint8Array` を渡すとTS5.5で `Uint8Array<ArrayBufferLike>` の型エラーが出るため、`src/audio.ts` 内で `as Uint8Array<ArrayBuffer>` にキャストしている。
- `import.meta.glob` の型解決に `vite/client` の型定義が必要なため、`tsconfig.json` の `compilerOptions.types` に `"vite/client"` を追加している。
- WebGLシーンの `audio` の値は、操作UI側の強度スライダー(0〜3倍)でスケールされるため1.0を超えうる。シェーダー内で `clamp()` せずに使うと発散・白飛びしやすいので、`04-feedback-loop.ts` のように上限をクランプしてから使う。
- 操作UI・投影窓とも、2D用/WebGL用の2枚のcanvasを重ねて配置し、アクティブなシーンの `kind` に応じて `display: none` で表示を切り替えている。`display: none` の間はそのcanvasの `clientWidth/clientHeight` が0になるため、シーン切替時は表示状態を変えた直後に必ずリサイズ処理(`resize()`)を呼び直す必要がある(呼ばないとWebGL側の内部解像度が0のままになり描画されない)。

### 操作方法(control.html)

| キー / UI | 動作 |
|---|---|
| Space / マイクボタン | マイク入力を有効化(全投影窓共通) |
| ← / → / スライダー | エフェクトの強度を調整(0〜3、全投影窓共通) |
| 投影窓ごとのセレクトボックス | その投影窓に表示するシーンを個別に切り替え |
| 投影窓ごとのパレットUI | プリセット選択 / メイン・サブのカラーピッカーで配色を個別に設定([specs/004-scene-color-palette.md](specs/004-scene-color-palette.md)参照) |

数字キーによるシーン切替は廃止済み(投影窓ごとにシーンが異なりうるため、「どの窓に効くか」が曖昧になるのを避けている)。投影窓側では `F` キーでフルスクリーン切り替え。
