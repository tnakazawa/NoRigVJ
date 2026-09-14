# src/scenes/CLAUDE.md

ビジュアルシーンを追加・変更するときのガイド。マルチウィンドウ側(control.ts/display.ts)の話は [../CLAUDE.md](../CLAUDE.md) を参照。

## 構成

1シーン1ファイルで、ビルド時に自動収集される([シーン追加の手順](#シーン追加の手順)参照)。

- [_shared/types.ts](_shared/types.ts) — `Palette` / `Scene2D` / `SceneWebGL` / `Scene`(Union型)/ `SceneFactory` などの型定義。
- [_shared/color-utils.ts](_shared/color-utils.ts) — `hsl()`(非パレット対応シーン用)、`hexToRgb()` / `lerpColor()`(パレット対応シーン用)などの色ヘルパー。
- [index.ts](index.ts) — `import.meta.glob` で `src/scenes/*.ts`(`_shared/` を除く)を自動収集し、`sceneFactories: SceneFactory[]` をexportする。
- 実装済みシーン: `01-pulse-rings.ts` / `03-noise-field.ts`(Canvas 2D、パレット対応) / `02-bar-spectrum.ts`(Canvas 2D、パレット非対応・時間経過で色相が回る) / `04-feedback-loop.ts`(WebGL、three.jsによるRenderTargetのピンポンでフィードバックループを表現、パレット対応)。カラーパレットの背景は [../../specs/004-scene-color-palette.md](../../specs/004-scene-color-palette.md) 参照。
- 4シーンとも `ctx.audio.beatPulse`(ビート発生時1→指数減衰)を使ったビート演出を持つ([../../specs/007-bpm-beat-sync.md](../../specs/007-bpm-beat-sync.md)参照): Pulse Ringsはビートごとにリングを1本追加生成して弾けさせる、Bar Spectrumは白フラッシュ、Noise Fieldはパーティクルを放射方向へ一瞬押し出す、Feedback Loopは発光(glow)を一瞬強める。新規シーン追加時、`beatPulse` を使うかどうかは任意(必須ではない)。

## シーン追加の手順

1. `src/scenes/NN-scene-name.ts` を作成する。`NN` は既存ファイルの最大値+1(2桁連番)。この連番がシーンの並び順・キー割当を決める。
2. `SceneFactory`(`() => Scene`)を `default export` する。**シーンオブジェクトを直接exportしない**こと — 操作UIのプレビューと投影窓はそれぞれ別canvas/別WebGLコンテキストを持つ上、シーン切替(クロスフェードの有無を問わず)のたびに毎回新しいインスタンスを生成する設計になっている([layer.ts](../layer.ts)の`createLayer()`参照)。同じシーンを選び直しても前回の状態は引き継がれない。
3. Canvas 2Dシーンは `kind: "2d"`、`render(ctx: SceneContext2D)` を実装する(`ctx.audio.volume/bass/mid/treble` と `ctx.time` を使う)。
4. WebGLシーンは `kind: "webgl"`、`render(ctx: SceneContextWebGL)` を実装する。シェーダーコンパイル・`WebGLRenderTarget` 確保など初回のみでよい処理は `init?(ctx)` に書く(シーンごとに一度だけ呼ばれる)。`04-feedback-loop.ts` を参考にする。
5. `supportsPalette: boolean` を指定する。`true` なら `ctx.palette.main` / `ctx.palette.sub`(16進カラーコード)を使って配色する。`false` なら投影窓行のパレットUIが無効化され、`palette` は渡されるが無視してよい(独自の配色ロジック・時間経過での色相変化などをそのまま使える)。
6. ファイルを置くだけで `sceneFactories` に自動的に反映され、各投影窓行のシーン選択セレクトボックスの選択肢として自動的に追加される。`index.ts` の編集は不要。

## 既知の注意点

- `import.meta.glob` の型解決に `vite/client` の型定義が必要なため、`tsconfig.json` の `compilerOptions.types` に `"vite/client"` を追加している。
- WebGLシーンの `audio` の値は、操作UI側の強度スライダー(0〜3倍)でスケールされるため1.0を超えうる。シェーダー内で `clamp()` せずに使うと発散・白飛びしやすいので、`04-feedback-loop.ts` のように上限をクランプしてから使う。
- WebGLシーンで `vUv`(0-1の正方形UV空間)をそのまま距離計算・回転に使うと、canvasが正方形でない場合(プレビューや投影窓は基本的に正方形でない)に真円が楕円に潰れる。`04-feedback-loop.ts` のように `uAspect`(`width / height`)をuniformで渡し、`(vUv - 0.5) * vec2(uAspect, 1.0)` で中心基準・アスペクト比補正した座標系にしてから計算すること。
- クロスフェード中([../specs/006-scene-crossfade.md](../../specs/006-scene-crossfade.md)参照)は旧シーン・新シーンが同時にレンダリングされるため、両方がWebGLシーンだと投影窓1つあたり一時的に2つの`WebGLRenderer`(WebGLコンテキスト)が併存する。通常利用では問題にならない範囲だが、ブラウザのWebGLコンテキスト数には上限があることは頭の片隅に置いておく。
