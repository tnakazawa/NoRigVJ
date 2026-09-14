# src/scenes/CLAUDE.md

ビジュアルシーンを追加・変更するときのガイド。マルチウィンドウ側(control.ts/display.ts)の話は [../CLAUDE.md](../CLAUDE.md) を参照。

## 構成

1シーン1ファイルで、ビルド時に自動収集される([シーン追加の手順](#シーン追加の手順)参照)。全シーンWebGL(three.js)で描画する([../../specs/009-webgl-only-scenes.md](../../specs/009-webgl-only-scenes.md)でCanvas 2D方式は廃止済み)。

- [_shared/types.ts](_shared/types.ts) — `Palette` / `Scene` / `SceneContext` / `SceneFactory` などの型定義。
- [_shared/color-utils.ts](_shared/color-utils.ts) — `hexToRgb()` / `lerpColor()` などの色ヘルパー。
- [index.ts](index.ts) — `import.meta.glob` で `src/scenes/*.ts`(`_shared/` を除く)を自動収集し、`sceneFactories: SceneFactory[]` をexportする。
- 実装済みシーン(全9): `01-pulse-rings.ts`(音量に反応するトーラスの同心円) / `02-bar-spectrum.ts`(`InstancedMesh`による3Dイコライザー、パレット非対応・時間経過で色相が回る) / `03-noise-field.ts`(`Points`によるパーティクル群) / `04-feedback-loop.ts`(`WebGLRenderTarget`のピンポンによるフィードバックループ) / `05-plasma-lava.ts`(フルスクリーンquad+シェーダー、sin波合成のプラズマ模様) / `06-wireframe-polyhedron.ts`(`PerspectiveCamera`を使う初のシーン、回転する複数のワイヤーフレーム多面体) / `07-kaleidoscope.ts`(フルスクリーンquad+シェーダー、極座標の角度分割による万華鏡) / `08-grid-terrain.ts`(`PerspectiveCamera`、頂点シェーダーで波打つワイヤーフレーム地形) / `09-bloom-particles.ts`(`EffectComposer`+`UnrealBloomPass`を使う唯一のシーン、加算合成パーティクル群)。`02-bar-spectrum.ts`以外は全てパレット対応。カラーパレットの背景は [../../specs/004-scene-color-palette.md](../../specs/004-scene-color-palette.md) 参照。
- 手動トリガー(Trigger 1/2/3、[../../specs/007-manual-trigger.md](../../specs/007-manual-trigger.md)参照)は `ctx.triggers`(固定長3、各0-1で発生時1→指数減衰)を使う。対応する演出があるシーンは `triggerEffectNames`(固定長3、対応インデックスに演出名・非対応は`undefined`)を持つ。現状 `01-pulse-rings.ts`(Ring Burst / Color Flip / Radius Kick)と `03-noise-field.ts`(Radial Push / Freeze / Color Flash)の2シーンが3種類ずつ対応。新規シーンで対応する場合、`triggerEffectNames` ごと省略してよい(未対応シーンでは操作UI側のボタンが自動的に無効化される)。

## シーン追加の手順

1. `src/scenes/NN-scene-name.ts` を作成する。`NN` は既存ファイルの最大値+1(2桁連番)。この連番がシーンの並び順・キー割当を決める。
2. `SceneFactory`(`() => Scene`)を `default export` する。**シーンオブジェクトを直接exportしない**こと — 操作UIのプレビューと投影窓はそれぞれ別canvas/別WebGLコンテキストを持つ上、シーン切替(クロスフェードの有無を問わず)のたびに毎回新しいインスタンスを生成する設計になっている([layer.ts](../layer.ts)の`createLayer()`参照)。同じシーンを選び直しても前回の状態は引き継がれない。
3. `render(ctx: SceneContext)` を実装する(`ctx.audio.volume/bass/mid/treble`・`ctx.time`・`ctx.renderer`(`THREE.WebGLRenderer`)を使う)。シェーダーコンパイル・`WebGLRenderTarget` 確保など初回のみでよい処理は `init?(ctx)` に書く(シーンごとに一度だけ呼ばれる)。`04-feedback-loop.ts` を参考にする。
4. `supportsPalette: boolean` を指定する。`true` なら `ctx.palette.main` / `ctx.palette.sub`(16進カラーコード)を使って配色する。`false` なら投影窓行のパレットUIが無効化され、`palette` は渡されるが無視してよい(独自の配色ロジック・時間経過での色相変化などをそのまま使える)。
5. ファイルを置くだけで `sceneFactories` に自動的に反映され、各投影窓行のシーン選択セレクトボックスの選択肢として自動的に追加される。`index.ts` の編集は不要。

## 既知の注意点

- `import.meta.glob` の型解決に `vite/client` の型定義が必要なため、`tsconfig.json` の `compilerOptions.types` に `"vite/client"` を追加している。
- `audio` の値は、操作UI側の強度スライダー(0〜9倍)でスケールされるため1.0を大きく超えうる。シェーダー内・JS内で `clamp()` せずに使うと発散・白飛びしやすいので、必ず上限をクランプしてから使う。ただし一律 `0.0〜1.0` にすると、スライダーを上げても高い値域で見た目が変化しなくなる(既存の一部シーンで実際に起きた問題)。パラメータの使い道に応じてクランプ上限を選ぶこと: 色の補間係数(t)のように範囲外だと破綻するものは `0.0〜1.0` のまま、速度・周波数・スケール・不透明度のように範囲外でも破綻しないものは `2.0〜3.0` 程度まで緩める(`04-feedback-loop.ts` のvolumeのように発散・白飛びに直結するものだけ `1.0` のままにする)。
- フルスクリーンquadのシーン(`05-plasma-lava.ts` / `07-kaleidoscope.ts` 等)で `vUv`(0-1の正方形UV空間)をそのまま距離計算・回転に使うと、canvasが正方形でない場合(プレビューや投影窓は基本的に正方形でない)に真円が楕円に潰れる。`uAspect`(`width / height`)をuniformで渡し、`(vUv - 0.5) * vec2(uAspect, 1.0)` で中心基準・アスペクト比補正した座標系にしてから計算すること。`PerspectiveCamera`/`OrthographicCamera` を使うシーンは `camera.aspect = ctx.width / ctx.height; camera.updateProjectionMatrix();` を毎フレーム呼べばよい。
- クロスフェード中([../specs/006-scene-crossfade.md](../../specs/006-scene-crossfade.md)参照)は旧シーン・新シーンが同時にレンダリングされるため、投影窓1つあたり一時的に2つの`WebGLRenderer`(WebGLコンテキスト)が併存する。通常利用では問題にならない範囲だが、ブラウザのWebGLコンテキスト数には上限があることは頭の片隅に置いておく。
- `THREE.LineBasicMaterial` の `linewidth` は、ほぼ全てのブラウザ(ANGLE経由のWebGL実装)で1に固定される既知の制限がある。`06-wireframe-polyhedron.ts` では「線の太さ」の代わりに `opacity` を音声反応させて代用している。実際に太い線が必要な場合は `three/examples/jsm/lines/LineSegments2` 等(Fat Lines)を検討する必要があるが、実装コストが上がるため今は使っていない。
- `EffectComposer`/`UnrealBloomPass` など後処理を使う場合(`09-bloom-particles.ts`)は `three/examples/jsm/postprocessing/*.js` からimportする(three.js本体に同梱、追加パッケージ不要)。`render()` 内では `ctx.renderer.render()` の代わりに `composer.render()` を呼び、リサイズは毎フレーム `composer.setSize(ctx.width, ctx.height)` を呼ぶだけでよい(`EffectComposer` が内部のRenderTargetのリサイズを吸収してくれるため、`04-feedback-loop.ts` の `ensureRenderTargets` のような「サイズが変わった時だけ再生成」の工夫は不要)。
- `InstancedMesh`(`02-bar-spectrum.ts`)でインスタンスごとに色を変える場合、`instanceColor` に `THREE.InstancedBufferAttribute` を明示的にセットしてから `setColorAt()` を使う必要がある(コンストラクタが自動生成してくれないため)。
