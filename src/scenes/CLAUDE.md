# src/scenes/CLAUDE.md

ビジュアルシーンを追加・変更するときのガイド。マルチウィンドウ側(control.ts/display.ts)の話は [../CLAUDE.md](../CLAUDE.md) を参照。

## 構成

1シーン1ファイルで、ビルド時に自動収集される([シーン追加の手順](#シーン追加の手順)参照)。全シーンWebGL(three.js)で描画する([../../specs/009-webgl-only-scenes.md](../../specs/009-webgl-only-scenes.md)でCanvas 2D方式は廃止済み)。

- [_shared/types.ts](_shared/types.ts) — `Palette` / `Scene` / `SceneContext` / `SceneFactory` などの型定義。
- [_shared/color-utils.ts](_shared/color-utils.ts) — `hexToRgb()` / `lerpColor()` などの色ヘルパー。
- [index.ts](index.ts) — `import.meta.glob` で `src/scenes/*.ts`(`_shared/` を除く)を自動収集し、`sceneFactories: SceneFactory[]` をexportする。
- 実装済みシーン(全32): `01-pulse-rings.ts`(音量に反応するトーラスの同心円) / `02-bar-spectrum.ts`(`InstancedMesh`による3Dイコライザー、バーの位置に応じてmain→subへ配色) / `03-noise-field.ts`(`Points`によるパーティクル群) / `04-feedback-loop.ts`(`WebGLRenderTarget`のピンポンによるフィードバックループ) / `05-plasma-lava.ts`(フルスクリーンquad+シェーダー、sin波合成のプラズマ模様) / `06-wireframe-polyhedron.ts`(`PerspectiveCamera`を使う初のシーン、回転する複数のワイヤーフレーム多面体) / `07-kaleidoscope.ts`(フルスクリーンquad+シェーダー、極座標の角度分割による万華鏡) / `08-grid-terrain.ts`(`PerspectiveCamera`、頂点シェーダーで波打つワイヤーフレーム地形) / `09-bloom-particles.ts`(`EffectComposer`+`UnrealBloomPass`を使う唯一のシーン、加算合成パーティクル群) / `10-rainbow.ts`(フルスクリーンquad+シェーダー、太さ画面高さ1/13の虹色7色の水平帯を敷き詰め、時間経過で下方向へループさせる。虹の配色自体が特徴のためパレット非対応) / `11-starfield-warp.ts`(`Points`、カメラ手前へ一方向に流れ続ける星群。Noise Field/Bloom Particlesとは「揺れ」ではなく「前進」が主役という点で差別化) / `12-metaball-blob.ts`(`IcosahedronGeometry`の頂点をsin波合成で変位させた有機的な塊。simplex noise等は使わずsin波合成に留めている) / `13-halftone-dots.ts`(フルスクリーンquad+シェーダー、格子状の円ドットが音声で拡縮する印刷物のハーフトーン風グラフィック) / `14-lissajous-lines.ts`(`THREE.Line`によるリサージュ曲線。既存シーンは全て面の塗りつぶしだが、これが唯一の線画表現) / `15-voronoi-cells.ts`(フルスクリーンquad+シェーダー、Worley noiseによる不規則なセル境界模様) / `16-instanced-cube-grid.ts`(`InstancedMesh`、Bar Spectrumの2次元グリッド版で都市のビル群のような俯瞰構図) / `17-matrix-rain.ts`(フルスクリーンquad+シェーダー、実際の文字グリフは描画せず格子状ON/OFFパターンで「文字が流れ落ちる」印象を作るデジタル雨表現) / `18-dna-helix.ts`(`InstancedMesh`2組+`LineSegments`、二重螺旋状に回転する球体列と塩基対の連結線) / `19-fireworks.ts`(`Points`、複数shellが位相をずらして周期的に爆発・重力落下・消滅するライフサイクルを持つ) / `20-fresnel-glass-sphere.ts`(`SphereGeometry`+フレネル効果シェーダー、輪郭が光る半透明球) / `21-radial-rays.ts`(フルスクリーンquad+シェーダー、中心から放射する光線) / `22-aurora.ts`(フルスクリーンquad+シェーダー、複数layerのsin波を重ねたカーテン状の帯) / `23-spiral-galaxy.ts`(`Points`、中心ほど速く回転する渦巻き配置) / `24-flocking-boids.ts`(`Points`、分離・整列・結合の3ルールで前フレームの速度・位置を毎フレーム積み上げる、唯一の「状態を保持し続ける」パーティクルシーン) / `25-bouncing-balls.ts`(`InstancedMesh`、重力・反発の簡易物理でy位置を保持し続ける) / `26-chladni-patterns.ts`(フルスクリーンquad+シェーダー、Chladni図形の定常波パターン) / `27-sacred-geometry-mandala.ts`(フルスクリーンquad+シェーダー、重なる円で「生命の花」模様を作る) / `28-lightning-arcs.ts`(`THREE.Line`、位相をずらした複数本が周期的に発生・即座に消えるジグザグ線) / `29-glitch-blocks.ts`(フルスクリーンquad+シェーダー、ブロック単位のグリッチノイズ) / `30-radial-bar-spectrum.ts`(`InstancedMesh`、Bar Spectrumの円形配置版) / `31-origami-folding-planes.ts`(`PlaneGeometry`の頂点シェーダーでアコーディオン状の山折り・谷折りを表現) / `32-ribbon-wave.ts`(`THREE.TubeGeometry`を毎フレーム作り直す唯一のシーン、うねるチューブ状リボン)。`10-rainbow.ts`以外は全てパレット対応。カラーパレットの背景は [../../specs/004-scene-color-palette.md](../../specs/004-scene-color-palette.md) 参照。
- 手動トリガー(Trigger 1/2/3、[../../specs/007-manual-trigger.md](../../specs/007-manual-trigger.md)参照)は `ctx.triggers`(固定長3、各0-1で発生時1→指数減衰)を使う。対応する演出があるシーンは `triggerEffectNames`(固定長3、対応インデックスに演出名・非対応は`undefined`)を持つ。シーンは0〜3個の任意個数だけ対応してよく、無理に3つ埋める必要はない(実際2種類のみのシーンも多い)。現状30シーンが対応(残り2シーンは非対応のまま。全シーン対応を目指したものではなく、シーンごとに自由に選べる設計であることを維持するため意図的に一部残している):
  - `01-pulse-rings.ts`: Ring Burst / Color Flip / Radius Kick
  - `02-bar-spectrum.ts`: Height Kick(全バーの高さに一時オフセット) / Color Flip / White Flash(配色を白へ寄せる)
  - `03-noise-field.ts`: Radial Push / Freeze / Color Flash
  - `04-feedback-loop.ts`: Zoom Punch(前フレームの回転・縮小の歪み量を一時増幅) / Flash(中心の発光を一時増幅) / Invert(前フレームの配色を一時反転)
  - `06-wireframe-polyhedron.ts`: Spin Kick(回転速度を一時ブースト) / Scale Pulse(一時拡大) / Flash(配色を白へ寄せる)
  - `07-kaleidoscope.ts`: Segment Kick(分割数を一時的に増やす) / Spin Burst(回転速度を一時ブースト) / Flash(明るさを一時増幅)
  - `09-bloom-particles.ts`: Radial Burst(基準位置から放射方向に一時押し出す) / Bloom Flash(Bloom強度を一時増幅) / Freeze
  - `10-rainbow.ts`: Monochrome(彩度を落としグレースケールへ) / Pale(白へ寄せて淡く) / Darken(黒へ寄せて濃く)
  - `11-starfield-warp.ts`: Warp Speed(前進速度を一時大幅ブースト) / Flash(星を一時大きく白く)
  - `12-metaball-blob.ts`: Spike(変位量を一時増幅しトゲトゲに) / Smooth(変位量を一時0に絞り真球へ)
  - `13-halftone-dots.ts`: Invert(ドット/背景の配色を一時反転) / Zoom(グリッドを一時的に細かく) / Flash(白へ寄せる)
  - `14-lissajous-lines.ts`: Ratio Kick(周波数比に一時オフセットを加え模様を歪ませる) / Flash(白へ寄せる)
  - `15-voronoi-cells.ts`: Shuffle(格子密度を一時的に変え模様を組み替える) / Flash(白へ寄せる)
  - `16-instanced-cube-grid.ts`: Height Kick(全キューブの高さに一時オフセット) / Wave Pulse(中心からの波紋の振幅を一時増幅) / White Flash(配色を白へ寄せる)
  - `17-matrix-rain.ts`: Speed Burst(列の流れ速度を一時大幅ブースト) / Flash(白へ寄せる)
  - `18-dna-helix.ts`: Spin Kick(回転速度を一時ブースト) / Radius Pulse(螺旋の半径を一時膨らませる) / Flash(白へ寄せる)
  - `19-fireworks.ts`: Launch Burst(爆発の勢いを一時ブースト) / Flash(白へ寄せる)
  - `20-fresnel-glass-sphere.ts`: Glow Burst(輪郭の発光を一時増幅) / Core Flash(中心部も白く発光させる)
  - `21-radial-rays.ts`: Burst(発光範囲を一時的に広げる) / Spin(回転速度を一時ブースト)
  - `22-aurora.ts`: Brighten(発光を一時増幅) / Ripple(波の振幅を一時的に増幅)
  - `23-spiral-galaxy.ts`: Spin Burst(回転速度を一時ブースト) / Flash(白へ寄せる)
  - `24-flocking-boids.ts`: Scatter(分離力を一時的に強め群れを散らす) / Flash(白へ寄せる)
  - `25-bouncing-balls.ts`: Bounce Burst(立ち上がり検出で全ボールに上向きの速度を与える) / Flash(白へ寄せる)
  - `26-chladni-patterns.ts`: Mode Shift(振動モードを一時的にジャンプさせ模様を組み替える) / Flash(白へ寄せる)
  - `27-sacred-geometry-mandala.ts`: Bloom(半径を一時的に広げる) / Spin Burst(回転速度を一時ブースト) / Flash(白へ寄せる)
  - `28-lightning-arcs.ts`: Strike(全boltを強制的に発生・可視化する) / Flash(白へ寄せる。発生中はboltが非表示のタイミングでも強制的に見えるようにしている)
  - `29-glitch-blocks.ts`: Corrupt(グリッチのしきい値を下げ常時グリッチ状態にする) / Flash(白へ寄せる)
  - `30-radial-bar-spectrum.ts`: Height Kick(全バーの長さに一時オフセット) / Color Flip / White Flash(配色を白へ寄せる)
  - `31-origami-folding-planes.ts`: Fold(折れ角度を最大にする) / Flatten(折れ角度を0にする) / Flash(白へ寄せる)
  - `32-ribbon-wave.ts`: Wave Kick(うねりの振幅を一時的に増幅) / Flash(白へ寄せる)
  - `05-plasma-lava.ts` / `08-grid-terrain.ts` は現状非対応。新規シーンで対応する場合、`triggerEffectNames` ごと省略してよい(未対応シーンでは操作UI側のボタンが自動的に無効化される)。

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
- フラグメントシェーダーで `dFdx`/`dFdy`(`12-metaball-blob.ts` で、頂点変位後の法線を再計算せずスクリーンスペース微分からフラットシェーディング用の面法線を求めるのに使用)を使う場合、three.js r150以降はWebGL2がデフォルトのためコア機能として使え、`ShaderMaterial` に `extensions: { derivatives: true }` を渡す必要はない(古いバージョン向けの情報を参考にすると型エラーになる)。
- ほとんどのシーンは`render()`内で`ctx.time`(経過秒数)から毎フレーム位置を計算し直す設計だが、`24-flocking-boids.ts`(boidsの分離・整列・結合)と`25-bouncing-balls.ts`(重力・反発の物理)は例外的に、シーンインスタンスのクロージャ内に位置・速度をFloat32Arrayで保持し、前フレームの状態に力を積み上げていく設計にしている(`ctx.time`の差分をdtとして使う)。シーン切替のたびに新しいインスタンスが生成されるため、この状態はリセットされて問題ない([layer.ts](../layer.ts)の設計を参照)。
- `32-ribbon-wave.ts`は唯一、`render()`内で`THREE.TubeGeometry`を毎フレーム`dispose()`して作り直している。本来は頂点シェーダーでの変形やBufferAttributeの書き換えの方が効率的だが、チューブの断面形状を保ったまま制御点だけ動かすロジックを自前実装するのは煩雑なため、簡易実装として許容している(セグメント数を抑えているため実用上の負荷は問題にならない)。
