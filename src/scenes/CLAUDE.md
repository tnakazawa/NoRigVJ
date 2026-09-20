# src/scenes/CLAUDE.md

ビジュアルシーンを追加・変更するときのガイド。マルチウィンドウ側(control.ts/display.ts)の話は [../CLAUDE.md](../CLAUDE.md) を参照。

## 構成

1シーン1ファイルで、ビルド時に自動収集される([シーン追加の手順](#シーン追加の手順)参照)。全シーンWebGL(three.js)で描画する([../../specs/009-webgl-only-scenes.md](../../specs/009-webgl-only-scenes.md)でCanvas 2D方式は廃止済み)。

- [_shared/types.ts](_shared/types.ts) — `Palette` / `Scene` / `SceneContext` / `SceneFactory` などの型定義。
- [_shared/color-utils.ts](_shared/color-utils.ts) — `hexToRgb()` / `lerpColor()` などの色ヘルパー。
- [index.ts](index.ts) — `import.meta.glob` で `src/scenes/*.ts`(`_shared/` を除く)を自動収集し、`sceneFactories: SceneFactory[]` をexportする。
- 実装済みシーン(全33): `00-blank.ts`(何も描画しない空白シーン。暗転・シーン切替の合間用。パレット非対応) / `01-pulse-rings.ts`(音量に反応するトーラスの同心円) / `02-bar-spectrum.ts`(`InstancedMesh`による3Dイコライザー、バーの位置に応じてmain→subへ配色) / `03-noise-field.ts`(`Points`によるパーティクル群) / `04-feedback-loop.ts`(`WebGLRenderTarget`のピンポンによるフィードバックループ) / `05-plasma-lava.ts`(フルスクリーンquad+シェーダー、sin波合成のプラズマ模様) / `06-wireframe-polyhedron.ts`(`PerspectiveCamera`を使う初のシーン、回転する複数のワイヤーフレーム多面体) / `07-kaleidoscope.ts`(フルスクリーンquad+シェーダー、極座標の角度分割による万華鏡) / `08-grid-terrain.ts`(`PerspectiveCamera`、頂点シェーダーで波打つワイヤーフレーム地形) / `09-bloom-particles.ts`(`EffectComposer`+`UnrealBloomPass`を使う唯一のシーン、加算合成パーティクル群) / `10-rainbow.ts`(フルスクリーンquad+シェーダー、太さ画面高さ1/13の虹色7色の水平帯を敷き詰め、時間経過で下方向へループさせる。虹の配色自体が特徴のためパレット非対応) / `11-starfield-warp.ts`(`Points`、カメラ手前へ一方向に流れ続ける星群。Noise Field/Bloom Particlesとは「揺れ」ではなく「前進」が主役という点で差別化) / `12-metaball-blob.ts`(`IcosahedronGeometry`の頂点をsin波合成で変位させた有機的な塊。simplex noise等は使わずsin波合成に留めている) / `13-halftone-dots.ts`(フルスクリーンquad+シェーダー、格子状の円ドットが音声で拡縮する印刷物のハーフトーン風グラフィック) / `14-lissajous-lines.ts`(`THREE.Line`によるリサージュ曲線。既存シーンは全て面の塗りつぶしだが、これが唯一の線画表現) / `15-voronoi-cells.ts`(フルスクリーンquad+シェーダー、Worley noiseによる不規則なセル境界模様) / `16-instanced-cube-grid.ts`(`InstancedMesh`、Bar Spectrumの2次元グリッド版で都市のビル群のような俯瞰構図) / `17-matrix-rain.ts`(フルスクリーンquad+シェーダー、実際の文字グリフは描画せず格子状ON/OFFパターンで「文字が流れ落ちる」印象を作るデジタル雨表現) / `18-dna-helix.ts`(`InstancedMesh`2組+`LineSegments`、二重螺旋状に回転する球体列と塩基対の連結線) / `19-fireworks.ts`(`Points`、複数shellが位相をずらして周期的に爆発・重力落下・消滅するライフサイクルを持つ) / `20-fresnel-glass-sphere.ts`(`SphereGeometry`+フレネル効果シェーダー、輪郭が光る半透明球) / `21-radial-rays.ts`(フルスクリーンquad+シェーダー、中心から放射する光線) / `22-aurora.ts`(フルスクリーンquad+シェーダー、複数layerのsin波を重ねたカーテン状の帯) / `23-spiral-galaxy.ts`(`Points`、中心ほど速く回転する渦巻き配置) / `24-flocking-boids.ts`(`Points`、分離・整列・結合の3ルールで前フレームの速度・位置を毎フレーム積み上げる、唯一の「状態を保持し続ける」パーティクルシーン) / `25-bouncing-balls.ts`(`InstancedMesh`、重力・反発の簡易物理でy位置を保持し続ける) / `26-chladni-patterns.ts`(フルスクリーンquad+シェーダー、Chladni図形の定常波パターン) / `27-sacred-geometry-mandala.ts`(フルスクリーンquad+シェーダー、重なる円で「生命の花」模様を作る) / `28-lightning-arcs.ts`(`THREE.Line`、位相をずらした複数本が周期的に発生・即座に消えるジグザグ線) / `29-glitch-blocks.ts`(フルスクリーンquad+シェーダー、ブロック単位のグリッチノイズ) / `30-radial-bar-spectrum.ts`(`InstancedMesh`、Bar Spectrumの円形配置版) / `31-origami-folding-planes.ts`(`PlaneGeometry`の頂点シェーダーでアコーディオン状の山折り・谷折りを表現) / `32-ribbon-wave.ts`(`THREE.TubeGeometry`を毎フレーム作り直す唯一のシーン、うねるチューブ状リボン)。`00-blank.ts`・`10-rainbow.ts`以外は全てパレット対応。カラーパレットの背景は [../../specs/004-scene-color-palette.md](../../specs/004-scene-color-palette.md) 参照。
- FXパッド([../../specs/015-fx-pad.md](../../specs/015-fx-pad.md)参照、以前のTrigger 1/2/3を置き換えた)は `ctx.padX` / `ctx.padY`(各-1〜1、中心が0。パッドを押している位置、離すと共に0=中心)を使う。対応する演出があるシーンは `padSupported: true` を持つ(未対応は省略)。X軸・Y軸それぞれ異なるエフェクトに自由に割り当ててよい。半径・高さのような量的なエフェクトは値をそのまま使うと符号で自然に方向(正/負)が変わり、色の反転度合いのような比率的なエフェクトは`Math.abs()`で絶対値を使うと中心からの距離だけが効く左右対称な演出になる(既存シーンはこの2パターンを使い分けている)。現状は`00-blank.ts`(何も描画しないため対象外)を除く全32シーンが対応済み:
  - `01-pulse-rings.ts`: X = メイン/サブの補間反転度合い(`Math.abs(padX)`、Color Flipの連続版) / Y = 全リングの半径オフセット(`padY`そのまま、正で膨らむ・負で縮む、Radius Kickの連続版)
  - `02-bar-spectrum.ts`: X = 配色反転度合い(`Math.abs(padX)`、Color Flipの連続版) / Y = 全バーの高さオフセット(`padY`そのまま、正で伸びる・負で縮む、Height Kickの連続版。負で高さが0を下回らないよう`Math.max(0.05, ...)`でクランプ)
  - `03-noise-field.ts`: X = 正で白へ・負で黒へ寄せる(符号で方向が変わる対称式、Color Flashの連続版) / Y = 中心からの放射方向への押し出し強さ(`padY`そのまま、正で押し出す・負で引き寄せる、Radial Pushの連続版)
  - `04-feedback-loop.ts`: X = 前フレーム配色の反転度合い(`Math.abs(padX)`、Invertの連続版) / Y = 前フレームの回転・縮小の歪み量オフセット(`padY`そのまま、正で歪み増幅・負で歪みを弱め静止に近づく、Zoom Punchの連続版)。以前あったFlash(中心の発光を増幅)は「動き」と「色」で2軸を分けた方が体感差が出るため見送った
  - `05-plasma-lava.ts`: X = 模様の細かさ(周波数)オフセット(`padX`そのまま、正で細かく・負で粗く) / Y = 明るさオフセット(`padY`そのまま、正で明るく・負で暗く)。以前はTrigger非対応だったシーンに新規にFXパッド演出を追加した
  - `06-wireframe-polyhedron.ts`: X = 回転速度オフセット(`padX`そのまま、正で加速・負で減速し0を跨ぐと逆回転、Spin Kickの連続版) / Y = 白(正)/黒(負)へ寄せる対称式(Flashの連続版)。以前あったScale Pulse(一時拡大)は既存のbass反応スケールと役割が近いため見送った
  - `07-kaleidoscope.ts`: X = 分割数オフセット(`padX`そのまま、最小3分割にクランプ、Segment Kickの連続版) / Y = 明るさオフセット(`padY`そのまま、0未満にならないようクランプ、Flashの連続版)。以前あったSpin Burst(回転速度ブースト)は既存のtreble反応回転と役割が近いため見送った
  - `08-grid-terrain.ts`: X = 地形の起伏(振幅)オフセット(`padX`そのまま、正で起伏が激しく・負で平坦に近づく) / Y = 配色の基準オフセット(`padY`そのまま、正でsub寄り全体に・負でmain寄り全体に)。以前はTrigger非対応だったシーンに新規にFXパッド演出を追加した
  - `09-bloom-particles.ts`: X = 基準位置からの放射方向オフセット(`padX`そのまま、正で押し出し・負で引き寄せ、Radial Burstの連続版) / Y = 揺れの時間経過の速さ(`timeScale = max(0, 1 + padY)`、負に倒すほど停止に近づく、Freezeの連続版)。以前あったBloom Flash(Bloom強度増幅)は既存のvolume反応Bloomと概念が近いため見送った
  - `10-rainbow.ts`: X = グレースケール化度合い(`Math.abs(padX)`、Monochromeの連続版) / Y = 白(正)/黒(負)へ寄せる対称式(Pale/Darkenの連続版)。以前3種あったTriggerのうち対になる2つ(Pale/Darken)を1軸に統合できた好例
  - `11-starfield-warp.ts`: X = 前進速度オフセット(`padX`そのまま、0未満にならないようクランプ、Warp Speedの連続版) / Y = 白(正)/黒(負)へ寄せ、大きさも変える対称式(Flashの連続版)
  - `12-metaball-blob.ts`: Y = 変位量オフセット(`padY`そのまま、正で変位を増幅しトゲトゲに・負で変位を絞り真球に近づく、Spike/Smoothの連続版)。以前の2つのワンショット(Spike/Smooth)がちょうど逆方向の操作だったため1軸に統合できた。X軸に自然に対応する演出が見当たらず、意図的に未使用のまま
  - `13-halftone-dots.ts`: X = ドット/背景の配色反転度合い(`Math.abs(padX)`、Invertの連続版) / Y = グリッドの細かさオフセット(`padY`そのまま、分母を0.25以上にクランプし発散を防止、Zoomの連続版)。以前あったFlashは色反転+密度変化の方が視覚的に差別化できるため見送った
  - `14-lissajous-lines.ts`: X = 周波数比オフセット(`padX`そのまま、0.5を下限にクランプ、Ratio Kickの連続版) / Y = 白(正)/黒(負)へ寄せる対称式(Flashの連続版)
  - `15-voronoi-cells.ts`: X = 格子密度オフセット(`padX`そのまま、正で密に細かいセルへ・負で粗く大きいセルへ、Shuffleの連続版) / Y = 白(正)/黒(負)へ寄せる対称式(Flashの連続版)。以前のShuffleはトリガー押下中のみ増加だったが、連続値化にあたり負方向にも自然に振れるようにした
  - `16-instanced-cube-grid.ts`: X = 白(正)/黒(負)へ寄せる対称式(White Flashの連続版) / Y = 全キューブの高さオフセット(`padY`そのまま、正で伸びる・負で縮む、Height Kickの連続版)。以前あったWave Pulse(波紋の振幅増幅)はHeight Kickと効果が似て重複するため見送った
  - `17-matrix-rain.ts`: X = 列の流れ速度オフセット(`padX`そのまま、正で加速・負で減速、Speed Burstの連続版。`max()`で速度が0付近まで下がりすぎないようクランプ) / Y = 白(正)/黒(負)へ寄せる対称式(Flashの連続版)
  - `18-dna-helix.ts`: X = 回転速度オフセット(`padX`そのまま、正で加速・負で逆回転、Spin Kickの連続版) / Y = 螺旋の半径オフセット(`padY`そのまま、正で膨らむ・負で縮む、Radius Pulseの連続版。`Math.max()`で半径が0以下にならないようクランプ)。以前あったFlash(白へ寄せる)はX/Y2軸で手一杯のため見送った
  - `19-fireworks.ts`: X = 爆発の初速オフセット(`padX`そのまま、正でより勢いよく・負でよりゆっくり、Launch Burstの連続版。打ち上げが周期的に発生し続けるため連続的な勢い調整として成立する) / Y = 白(正)/黒(負)へ寄せる対称式(Flashの連続版)
  - `20-fresnel-glass-sphere.ts`: X = 輪郭の発光(フレネル項)オフセット(`padX`そのまま、正で強調・負で控えめに、Glow Burstの連続版) / Y = 中心部を白(正)/黒(負)へ寄せる対称式(Core Flashの連続版。不透明度にも`Math.abs(padY)`で加算し、どちら方向でも存在感が増すようにした)
  - `21-radial-rays.ts`: X = 回転速度オフセット(`padX`そのまま、正で加速・負で逆回転、Spinの連続版) / Y = 発光範囲オフセット(`padY`そのまま、正で広げる・負で狭める、Burstの連続版)
  - `22-aurora.ts`: X = 波の振幅オフセット(`padX`そのまま、正で激しく・負で穏やかに、Rippleの連続版) / Y = 発光強度オフセット(`padY`そのまま、正で明るく・負で暗く、Brightenの連続版)
  - `23-spiral-galaxy.ts`: X = 回転速度オフセット(`padX`そのまま、正で加速・負で逆回転、Spin Burstの連続版) / Y = 白(正)/黒(負)へ寄せる対称式(Flashの連続版)
  - `24-flocking-boids.ts`: X = 白(正)/黒(負)へ寄せる対称式(Flashの連続版) / Y = 分離力を強めて群れを散らす(正、Scatterの連続版)/結合力を強めて群れを密集させる(負)。以前は別々のワンショットではなくScatterのみだったが、負方向にも自然な対になる「Gather」を新設して1軸に統合した
  - `25-bouncing-balls.ts`: X = 白(正)/黒(負)へ寄せる対称式(Flashの連続版) / Y = ジャンプの発生確率・強さを底上げしてよく弾ませる(正)/重力を強めて床に沈み込ませる(負)。以前の「立ち上がり検出で1回だけ発火」のBounce Burstはワンショットで連続値と相性が悪いため、「押している間ジャンプの発生確率と強さを連続的に上げる」演出に作り直した
  - `26-chladni-patterns.ts`: X = 白(正)/黒(負)へ寄せる対称式(Flashの連続版) / Y = 振動モード(n)オフセット(`padY`そのまま、Mode Shiftの連続版。正負どちらの方向にも模様が組み替わる)
  - `27-sacred-geometry-mandala.ts`: X = 白(正)/黒(負)へ寄せる対称式(Flashの連続版) / Y = 半径オフセット(`padY`そのまま、正で花が開くように広がる・負で閉じるように縮む、Bloomの連続版)。以前あったSpin Burst(回転速度ブースト)は2軸の枠に収まらないため見送った
  - `28-lightning-arcs.ts`: X = 白(正)/黒(負)へ寄せる対称式(Flashの連続版) / Y = 稲妻が見えている時間を連続的に伸縮(正で常時発生に近づく・負で消えていく、Strikeの連続版)。以前の「強制的に全bolt発生」というStrikeはワンショットで連続値と相性が悪いため、「可視時間の長さ」を連続的に変える演出に作り直した
  - `29-glitch-blocks.ts`: X = 白(正)/黒(負)へ寄せる対称式(Flashの連続版) / Y = グリッチのしきい値オフセット(`padY`そのまま、正で常時グリッチに近づく・負で鎮まる、Corruptの連続版)
  - `30-radial-bar-spectrum.ts`: X = 配色反転度合い(`Math.abs(padX)`、Color Flipの連続版) / Y = 全バーの長さオフセット(`padY`そのまま、正で伸びる・負で縮む、Height Kickの連続版)。Bar Spectrum(01)と同じ設計をそのまま踏襲した。以前あったWhite Flashは軸過多を避けるため見送った
  - `31-origami-folding-planes.ts`: X = 白(正)/黒(負)へ寄せる対称式(Flashの連続版) / Y = 正で折れ角度を最大(π/2)へ、負で0(平ら)へ連続的に寄せる。以前は別々のワンショットだったFold/Flattenを、両端の状態を作る1本の軸として統合した
  - `32-ribbon-wave.ts`: X = 白(正)/黒(負)へ寄せる対称式(Flashの連続版) / Y = うねりの振幅オフセット(`padY`そのまま、正で大きく波打つ・負で振幅が小さくなり平らに近づく、Wave Kickの連続版)
  - `00-blank.ts`のみ非対応(何も描画しないシーンのため対応不可)。新規シーンで対応する場合、`padSupported: true` を追加する(未対応シーンでは操作UI側のFXパッドが自動的に無効化される)。

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
- `THREE.LineBasicMaterial` の `linewidth` は、ほぼ全てのブラウザ(ANGLE経由のWebGL実装)で1に固定される既知の制限がある。`06-wireframe-polyhedron.ts` では「線の太さ」の代わりに `opacity` を音声反応させて代用している。実際に太い線が必要な場合は `three/examples/jsm/lines/{Line2, LineGeometry, LineMaterial}`(Fat Lines)を使う。`28-lightning-arcs.ts` で採用済み(`LineMaterial` の `linewidth` はピクセル単位の値を取れる。`resolution` をcanvasサイズに合わせて毎フレーム更新する必要がある点、頂点の設定が `geometry.setAttribute()` ではなく `geometry.setPositions(flatArray)` という専用APIになる点が `THREE.Line` と異なる)。
- `EffectComposer`/`UnrealBloomPass` など後処理を使う場合(`09-bloom-particles.ts`)は `three/examples/jsm/postprocessing/*.js` からimportする(three.js本体に同梱、追加パッケージ不要)。`render()` 内では `ctx.renderer.render()` の代わりに `composer.render()` を呼び、リサイズは毎フレーム `composer.setSize(ctx.width, ctx.height)` を呼ぶだけでよい(`EffectComposer` が内部のRenderTargetのリサイズを吸収してくれるため、`04-feedback-loop.ts` の `ensureRenderTargets` のような「サイズが変わった時だけ再生成」の工夫は不要)。
- `InstancedMesh`(`02-bar-spectrum.ts`)でインスタンスごとに色を変える場合、`instanceColor` に `THREE.InstancedBufferAttribute` を明示的にセットしてから `setColorAt()` を使う必要がある(コンストラクタが自動生成してくれないため)。
- フラグメントシェーダーで `dFdx`/`dFdy`(`12-metaball-blob.ts` で、頂点変位後の法線を再計算せずスクリーンスペース微分からフラットシェーディング用の面法線を求めるのに使用)を使う場合、three.js r150以降はWebGL2がデフォルトのためコア機能として使え、`ShaderMaterial` に `extensions: { derivatives: true }` を渡す必要はない(古いバージョン向けの情報を参考にすると型エラーになる)。
- ほとんどのシーンは`render()`内で`ctx.time`(経過秒数)から毎フレーム位置を計算し直す設計だが、`24-flocking-boids.ts`(boidsの分離・整列・結合)と`25-bouncing-balls.ts`(重力・反発の物理)は例外的に、シーンインスタンスのクロージャ内に位置・速度をFloat32Arrayで保持し、前フレームの状態に力を積み上げていく設計にしている(`ctx.time`の差分をdtとして使う)。シーン切替のたびに新しいインスタンスが生成されるため、この状態はリセットされて問題ない([layer.ts](../layer.ts)の設計を参照)。
- `32-ribbon-wave.ts`は唯一、`render()`内で`THREE.TubeGeometry`を毎フレーム`dispose()`して作り直している。本来は頂点シェーダーでの変形やBufferAttributeの書き換えの方が効率的だが、チューブの断面形状を保ったまま制御点だけ動かすロジックを自前実装するのは煩雑なため、簡易実装として許容している(セグメント数を抑えているため実用上の負荷は問題にならない)。
