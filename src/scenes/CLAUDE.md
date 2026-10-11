# src/scenes/CLAUDE.md

ビジュアルシーンを追加・変更するときのガイド。マルチウィンドウ側(control.ts/display.ts)の話は [../CLAUDE.md](../CLAUDE.md) を参照。

## 構成

1シーン1ファイルで、ビルド時に自動収集される([シーン追加の手順](#シーン追加の手順)参照)。全シーンWebGL(three.js)で描画する([../../specs/009-webgl-only-scenes.md](../../specs/009-webgl-only-scenes.md)でCanvas 2D方式は廃止済み)。

- [_shared/types.ts](_shared/types.ts) — `Palette` / `Scene` / `SceneContext` / `SceneFactory` などの型定義。
- [_shared/color-utils.ts](_shared/color-utils.ts) — `hexToRgb()` / `lerpColor()` などの色ヘルパー。
- [index.ts](index.ts) — `import.meta.glob` で `src/scenes/*.ts`(`_shared/` と `*.test.ts` を除く)を自動収集し、`sceneFactories: SceneFactory[]` をexportする。`scenes/` 直下に置いたテストファイル(例: [scenes.test.ts](scenes.test.ts))がシーンとして誤収集されないよう、globで `!./*.test.ts` を除外している。
- シーンの一覧と見た目の説明は [../../README.md](../../README.md) の「Scenes」。ファイル名の連番が並び順。新しいシーンを作るときの「近い実装」は、技法で探せる(索引は陳腐化するので置かない):

  ```bash
  grep -l InstancedMesh src/scenes/[0-9]*.ts       # InstancedMesh
  grep -l OrthographicCamera src/scenes/[0-9]*.ts  # フルスクリーンquad + シェーダー
  grep -l "THREE.Points" src/scenes/[0-9]*.ts      # パーティクル
  ```

- パレット非対応(`supportsPalette: false`)は、何も描画しない `00-blank.ts` と、虹の配色自体が特徴の `10-rainbow.ts` のみ。カラーパレットの背景は [../../specs/004-scene-color-palette.md](../../specs/004-scene-color-palette.md) 参照。

## FXパッド

[../../specs/015-fx-pad.md](../../specs/015-fx-pad.md)参照。`ctx.padX` / `ctx.padY`(各-1〜1、中心が0。パッドを押している位置、離すと共に0)を使う。対応する演出があるシーンは `padSupported: true` を持つ(`00-blank.ts` のみ非対応。表示中のどの投影窓も未対応のシーンだと、操作UI側のパッドは自動的に無効化される)。X軸・Y軸それぞれ異なるエフェクトに自由に割り当ててよい(両軸を埋める必要はなく、`12-metaball-blob.ts` はY軸のみ)。

- 半径・高さ・速度のような**量的なエフェクト**は値をそのまま使う。符号で方向が変わる(正で膨らむ・負で縮む)。
- 色の反転度合いのような**比率的なエフェクト**は `Math.abs()` で絶対値を使う。中心からの距離だけが効く左右対称な演出になる。
- 白(正)/黒(負)へ寄せる演出は、`03-noise-field.ts` と同じ対称式(`flash >= 0` なら白へ、`< 0` なら黒へ線形補間)を踏襲する。
- 負方向や極端な値で破綻する量(半径・分割数・速度・明るさなど)は、`Math.max()` / `clamp()` で下限を設ける。
- 感度は実機で確認する。フィードバック系(`04-feedback-loop.ts`)のように入力が毎フレーム累積するシーンは急に効くので `pow()` で中心付近を鈍らせ、正負で効き方が違うシーンは係数を分ける(事例は仕様書の「追加修正: 感度調整」)。
- 各シーンの演出内容は [../../README.md](../../README.md) の「FX Pad」と各シーンのコード、見送った演出とその理由は仕様書にある。

## シーン追加の手順

1. `src/scenes/NN-scene-name.ts` を作成する。`NN` は既存ファイルの最大値+1(2桁連番)。この連番がシーンの並び順を決める。
2. `SceneFactory`(`() => Scene`)を `default export` する。**シーンオブジェクトを直接exportしない** — 操作UIのプレビューと投影窓はそれぞれ別canvas/別WebGLコンテキストを持つ上、シーン切替(クロスフェードの有無を問わず)のたびに毎回新しいインスタンスを生成する設計になっている([layer.ts](../layer.ts)の`createLayer()`参照)。同じシーンを選び直しても前回の状態は引き継がれない。
3. `render(ctx: SceneContext)` を実装する(`ctx.audio.volume/bass/mid/treble`・`ctx.time`・`ctx.renderer`(`THREE.WebGLRenderer`)を使う)。シェーダーコンパイル・`WebGLRenderTarget` 確保など初回のみでよい処理は `init?(ctx)` に書く(シーンごとに一度だけ呼ばれる)。`04-feedback-loop.ts` を参考にする。
4. `supportsPalette: boolean` を指定する。`true` なら `ctx.palette.main` / `ctx.palette.sub`(16進カラーコード)を使って配色する。`false` なら投影窓行のパレットUIが無効化され、`palette` は渡されるが無視してよい(独自の配色ロジック・時間経過での色相変化などをそのまま使える)。
5. FXパッドに対応するなら `padSupported: true` を付け、`ctx.padX` / `ctx.padY` を使う(上記「FXパッド」)。
6. ファイルを置くだけで `sceneFactories` に自動的に反映され、各投影窓行のシーン選択セレクトボックスの選択肢として自動的に追加される。`index.ts` の編集は不要。[scenes.test.ts](scenes.test.ts) が名前の重複・FXパッド対応・パレット非対応の不変条件を自動で検査する。

## 既知の注意点

- `import.meta.glob` の型解決に `vite/client` の型定義が必要なため、`tsconfig.json` の `compilerOptions.types` に `"vite/client"` を追加している。
- `audio` の値は、操作UI側の強度スライダー(0〜9倍)でスケールされるため1.0を大きく超えうる。シェーダー内・JS内で `clamp()` せずに使うと発散・白飛びしやすいので、必ず上限をクランプしてから使う。ただし一律 `0.0〜1.0` にすると、スライダーを上げても高い値域で見た目が変化しなくなる(既存の一部シーンで実際に起きた問題)。パラメータの使い道に応じてクランプ上限を選ぶこと: 色の補間係数(t)のように範囲外だと破綻するものは `0.0〜1.0` のまま、速度・周波数・スケール・不透明度のように範囲外でも破綻しないものは `2.0〜3.0` 程度まで緩める(`04-feedback-loop.ts` のvolumeのように発散・白飛びに直結するものだけ `1.0` のままにする)。
- フルスクリーンquadのシーン(`05-plasma-lava.ts` / `07-kaleidoscope.ts` 等)で `vUv`(0-1の正方形UV空間)をそのまま距離計算・回転に使うと、canvasが正方形でない場合(プレビューや投影窓は基本的に正方形でない)に真円が楕円に潰れる。`uAspect`(`width / height`)をuniformで渡し、`(vUv - 0.5) * vec2(uAspect, 1.0)` で中心基準・アスペクト比補正した座標系にしてから計算すること。`PerspectiveCamera`/`OrthographicCamera` を使うシーンは `camera.aspect = ctx.width / ctx.height; camera.updateProjectionMatrix();` を毎フレーム呼べばよい。
- クロスフェード中([../../specs/006-scene-crossfade.md](../../specs/006-scene-crossfade.md)参照)は旧シーン・新シーンが同時にレンダリングされるため、投影窓1つあたり一時的に2つの`WebGLRenderer`(WebGLコンテキスト)が併存する。通常利用では問題にならない範囲だが、ブラウザのWebGLコンテキスト数には上限があることは頭の片隅に置いておく。
- `THREE.LineBasicMaterial` の `linewidth` は、ほぼ全てのブラウザ(ANGLE経由のWebGL実装)で1に固定される既知の制限がある。`06-wireframe-polyhedron.ts` では「線の太さ」の代わりに `opacity` を音声反応させて代用している。実際に太い線が必要な場合は `three/examples/jsm/lines/{Line2, LineGeometry, LineMaterial}`(Fat Lines)を使う。`28-lightning-arcs.ts` で採用済み(`LineMaterial` の `linewidth` はピクセル単位の値を取れる。`resolution` をcanvasサイズに合わせて毎フレーム更新する必要がある点、頂点の設定が `geometry.setAttribute()` ではなく `geometry.setPositions(flatArray)` という専用APIになる点が `THREE.Line` と異なる)。
- `EffectComposer`/`UnrealBloomPass` など後処理を使う場合(`09-bloom-particles.ts`)は `three/examples/jsm/postprocessing/*.js` からimportする(three.js本体に同梱、追加パッケージ不要)。`render()` 内では `ctx.renderer.render()` の代わりに `composer.render()` を呼び、リサイズは毎フレーム `composer.setSize(ctx.width, ctx.height)` を呼ぶだけでよい(`EffectComposer` が内部のRenderTargetのリサイズを吸収してくれるため、`04-feedback-loop.ts` の `ensureRenderTargets` のような「サイズが変わった時だけ再生成」の工夫は不要)。
- `InstancedMesh`(`02-bar-spectrum.ts`)でインスタンスごとに色を変える場合、`instanceColor` に `THREE.InstancedBufferAttribute` を明示的にセットしてから `setColorAt()` を使う必要がある(コンストラクタが自動生成してくれないため)。
- フラグメントシェーダーで `dFdx`/`dFdy`(`12-metaball-blob.ts` で、頂点変位後の法線を再計算せずスクリーンスペース微分からフラットシェーディング用の面法線を求めるのに使用)を使う場合、three.js r150以降はWebGL2がデフォルトのためコア機能として使え、`ShaderMaterial` に `extensions: { derivatives: true }` を渡す必要はない(古いバージョン向けの情報を参考にすると型エラーになる)。
- ほとんどのシーンは`render()`内で`ctx.time`(経過秒数)から毎フレーム位置を計算し直す設計だが、`24-flocking-boids.ts`(boidsの分離・整列・結合)と`25-bouncing-balls.ts`(重力・反発の物理)は例外的に、シーンインスタンスのクロージャ内に位置・速度をFloat32Arrayで保持し、前フレームの状態に力を積み上げていく設計にしている(`ctx.time`の差分をdtとして使う)。シーン切替のたびに新しいインスタンスが生成されるため、この状態はリセットされて問題ない([layer.ts](../layer.ts)の設計を参照)。
- `32-ribbon-wave.ts`は唯一、`render()`内で`THREE.TubeGeometry`を毎フレーム`dispose()`して作り直している。本来は頂点シェーダーでの変形やBufferAttributeの書き換えの方が効率的だが、チューブの断面形状を保ったまま制御点だけ動かすロジックを自前実装するのは煩雑なため、簡易実装として許容している(セグメント数を抑えているため実用上の負荷は問題にならない)。
