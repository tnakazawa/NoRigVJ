# 008: 追加WebGLシーン5種

- ステータス: Implemented
- 作成日: 2026-09-14

## 背景・目的

現状のシーンは4つ(Pulse Rings / Bar Spectrum / Noise Field / Feedback Loop)で、表現の幅を広げたい。[three.js examples](https://threejs.org/examples/)を参考に、既存シーンと表現が被らないWebGLシーンを5つ追加する。

## 要件

### 共通方針

- 全シーン `kind: "webgl"`、`supportsPalette: true`(メイン/サブ2色を使う)。
- 手動トリガー(Trigger 1/2/3、[specs/007-manual-trigger.md](007-manual-trigger.md)参照)は今回は非対応(`triggerEffectNames` を省略)とする。後日追加可能。
- 既存シーンと同様、`ctx.audio`(volume/bass/mid/treble、強度スライダーで0〜3倍にスケールされうる)と `ctx.time` で反応させる。シェーダー内で使う値は既存シーン同様 `clamp(0.0, 1.0)` してから使う([src/scenes/CLAUDE.md](../src/scenes/CLAUDE.md)の既知の注意点参照)。
- ファイル名は連番の続き: `05-plasma-lava.ts` `06-wireframe-polyhedron.ts` `07-kaleidoscope.ts` `08-grid-terrain.ts` `09-bloom-particles.ts`。

### 05: Plasma Lava(プラズマ/溶岩シェーダー)

- 既存Feedback Loopと同じ「フルスクリーンquad + フラグメントシェーダー」構成(`OrthographicCamera` + `PlaneGeometry(2,2)`)。RenderTargetのピンポンは不要(前フレーム参照なし)。
- 複数のsin波(x, y, 距離、斜め方向など)を合成した古典的プラズマパターンを作り、0-1の値をパレットのmain/sub間で補間して発色する。
- 音声反応: `bass` で波のうねりの速度、`treble` で模様の細かさ(周波数)、`volume` で全体の発光強度。

### 06: Wireframe Polyhedron(奥行きのある3D多面体)

- 初めて `PerspectiveCamera` を使うシーン(既存シーンは全て正面構図)。
- `IcosahedronGeometry` 等をワイヤーフレーム表示。誇大化を避けるため、頂点変形などは行わず、複数の多面体(サイズ違いを2〜3個)を重ねて回転させる程度に留める。
- 配色: エッジをパレットのmainで、内側にサブカラーの淡いグローを乗せる(または多面体ごとにmain/sub間で線色を補間)。
- 音声反応: `bass` でスケール(パルス的な拡大縮小)、`volume` で回転速度、`treble` で線の太さ。

### 07: Kaleidoscope(万華鏡シェーダー)

- フルスクリーンquad構成(05と同様)。フラグメントシェーダーでuvを中心基準の極座標に変換し、角度をN分割してmod演算で反復させることで万華鏡状の対称模様を作る。
- 模様自体は05のプラズマ同様、sin波の合成でよい(反復・対称性が主役のため模様自体は単純でよい)。
- 音声反応: `bass` で分割数相当のパラメータ(段階的に変化)、`volume` で発光強度、`treble` で回転速度。
- パレットのmain/subで模様を発色。

### 08: Grid Terrain(波打つワイヤーフレーム地形)

- `PerspectiveCamera` で見下ろす構図。`PlaneGeometry`(segments多め)をワイヤーフレーム表示し、頂点シェーダーでY座標を `sin(x*freq + time) + sin(z*freq + time)` 的な式で変位させる。
- 音声反応: `bass` で変位の振幅、`treble` で変位の細かさ(周波数)、`volume` で発光強度(色の明るさ)。
- パレット: 手前をmain、奥(フォグ的に)をsubへブレンド、または高さに応じてmain/sub間を補間。

### 09: Bloom Particles(発光パーティクル)

- three.js標準の後処理(`EffectComposer` + `RenderPass` + `UnrealBloomPass`、追加ライブラリ不要・three.js本体に含まれる)を使い、加算合成のパーティクル群(`Points` + `PointsMaterial` or `ShaderMaterial`)を発光させる。
- このシーンのみ `render()` 内で `renderer.render()` の代わりに `composer.render()` を呼ぶ。リサイズ時は既存のFeedback Loopの `ensureRenderTargets` と同様のパターンで、composer/bloomPassのサイズも追従させる。
- 音声反応: `bass` でパーティクルの動きの速さ、`volume` でBloomの強度(`strength`)、`treble` でパーティクル数・散らばり具合。
- パレット: パーティクルごとにmain/sub間で発光色を補間(Noise Fieldと同様の疑似乱数補間)。

## 非機能要件

- 既存4シーン・シーン切替・カラーパレット・シーンプリセット・クロスフェード・複数投影窓・手動トリガー・マイク解析機能は引き続き問題なく動作すること。
- 引き続きオフラインで動作すること(three.js本体に含まれるモジュールのみ使用、外部アセット・CDN不要)。
- クロスフェード中は投影窓1つあたり最大2つのWebGLシーンが同時レンダリングされる([src/scenes/CLAUDE.md](../src/scenes/CLAUDE.md)の既知の注意点参照)。シーン数が9個に増えても、同時に存在するWebGLコンテキスト数(投影窓ごとに最大2、複数投影窓ならその窓数倍)は変わらないため、追加の対策は不要と判断する。

## 受け入れ基準

- [x] 5シーンがシーン選択の一覧に追加され、選択・プレビュー・投影窓への反映ができる
- [x] 各シーンが説明通りの音声反応(bass/volume/treble)を持つ
- [x] 各シーンがパレットのmain/subを使って発色し、パレット変更が反映される
- [x] 5シーンとも、クロスフェード・複数投影窓・シーンプリセットの保存呼び出しが既存シーンと同様に機能する
- [x] Bloom Particlesのリサイズ(投影窓サイズ変更)時にcomposerの解像度も追従し、描画が崩れない
- [x] 既存4シーン・手動トリガー・BroadcastChannel同期など既存機能に影響がない

## 実装メモ

- 05・07(Plasma Lava / Kaleidoscope)は既存Feedback Loopと同じ「フルスクリーンquad + シェーダー」構成をそのまま踏襲。RenderTargetのピンポンが無い分、`04-feedback-loop.ts` よりシンプル。
- 06(Wireframe Polyhedron)は仕様通り `IcosahedronGeometry` を3サイズ`EdgesGeometry`化して重ねる方式にした。「trebleで線の太さ」は当初の想定通りには実装できなかった: `THREE.LineBasicMaterial.linewidth` はほぼ全ブラウザで1固定になる既知の制限があり、代わりに `material.opacity` をtrebleに反応させて代用した([src/scenes/CLAUDE.md](../src/scenes/CLAUDE.md)の既知の注意点に追記済み)。
- 08(Grid Terrain)は `PlaneGeometry(10, 10, 60, 60)` を `wireframe: true` の `ShaderMaterial` で描画し、頂点シェーダー内でZ座標(`rotation.x = -Math.PI/2` で寝かせているため見た目はY方向の変位になる)をsin波2本の合成で変位させた。色は変位量(高さ)に応じてmain/subを補間している。
- 09(Bloom Particles)は仕様で「Feedback Loopの`ensureRenderTargets`と同様のパターンでリサイズ追従」としていたが、実装してみると `EffectComposer`/`UnrealBloomPass` は内部で `setSize()` 呼び出し時にRenderTargetのリサイズを自前で処理してくれるため、`ensureRenderTargets` のような「サイズが変わった時だけ再生成」の分岐は不要だった。`render()` の中で毎フレーム `composer.setSize(ctx.width, ctx.height)` を呼ぶだけのシンプルな実装にしている(詳細は [src/scenes/CLAUDE.md](../src/scenes/CLAUDE.md) 既知の注意点参照)。パーティクル(800個)は `BufferAttribute` を毎フレーム書き換え、`AdditiveBlending`+`depthWrite: false` で加算合成している。
- 実機Chrome(開発サーバー、`window.open` を一時的にスタブ化してこの環境の制約を回避)で、5シーン全ての操作UIプレビュー表示・パレット反映・トリガーボタンの無効化(非対応のため)を確認。さらに2つ目の投影窓を実際に開き(`display.html?windowId=...`)、Grid Terrain・Bloom ParticlesがBroadcastChannel経由で投影窓側にも正しく反映されること、投影窓のビューポートを500×900に変更してもBloom Particlesのcomposerが追従し描画が崩れないことを確認した。
