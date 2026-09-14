# 009: 全シーンWebGL化・Canvas 2D方式の廃止

- ステータス: Implemented
- 作成日: 2026-09-14

## 背景・目的

Canvas 2Dシーン(Pulse Rings / Bar Spectrum / Noise Field)は、WebGL(three.js)シーンに比べて見た目の見劣りが大きい。試作として [src/scenes/10-bar-spectrum-gl.ts](../src/scenes/10-bar-spectrum-gl.ts) でBar SpectrumのWebGL版(3Dイコライザー、`InstancedMesh`)を作成し、FPS計測(単一投影窓・3投影窓同時とも60fps安定、Canvas版と同等)で問題ないことを確認済み。これを踏まえ、残る2つのCanvas 2Dシーン(Pulse Rings / Noise Field)もWebGL化し、Canvas 2D方式そのもの(型・レイヤー構成・canvas要素)をコードベースから撤去する。

Pulse Rings・Noise Fieldは手動トリガー演出([specs/007-manual-trigger.md](007-manual-trigger.md))の唯一の対応シーンでもあるため、単純な削除ではなくトリガー演出ごとWebGLへ移植する。

## 要件

### Pulse Rings(01-pulse-rings.ts)のWebGL化

- 表現: 複数の輪(`THREE.TorusGeometry`)を同心円状に並べる。既存の「正面から見た同心円」の構図を活かしつつ、リングをZ軸方向にわずかにずらして奥行きを持たせる(完全に同じ見た目である必要はない)。
- 音声反応: `bass`でリング半径(Zオフセット/スケール)、`volume`でリングの太さ(スケール)。既存Canvas版と同じ考え方を踏襲。
- パレット: 各リングをmain→sub間で線形補間した色にする(既存ロジックのTHREE.Color版)。
- 手動トリガー(既存と同じ3種、`triggerEffectNames`はそのまま維持):
  - Ring Burst(Trigger 1) — 新しいリングメッシュを動的に生成し、時間経過でスケール拡大・フェードアウトさせ、寿命が尽きたら破棄する。
  - Color Flip(Trigger 2) — 発生中、リングの色の補間方向を反転する。
  - Radius Kick(Trigger 3) — 発生中、全リングの半径(スケール)に一時的なオフセットを加える。

### Bar Spectrum(02-bar-spectrum.ts)のWebGL化

- [src/scenes/10-bar-spectrum-gl.ts](../src/scenes/10-bar-spectrum-gl.ts) の実装を `02-bar-spectrum.ts` に統合し、シーン名を `"Bar Spectrum GL"` から `"Bar Spectrum"` に戻す。`10-bar-spectrum-gl.ts` は削除する。
- `supportsPalette: false` のまま維持する(既存Canvas版と同様、時間経過で色相が回転する配色を活かすため。カラーパレット非対応シーンの実例としても引き続き残す)。

### Noise Field(03-noise-field.ts)のWebGL化

- 表現: `THREE.Points` + `BufferGeometry`(既存の [09-bloom-particles.ts](../src/scenes/09-bloom-particles.ts) と同じ実装パターン: 毎フレーム `BufferAttribute` を書き換え)。Bloom Particlesとの差別化のため、Bloom(後処理)は使わないシンプルな加算合成に留める。
- パーティクル数は固定(既存の最大値相当、300〜450程度)とし、`treble` に応じて可変にしていた挙動は「個々のパーティクルのサイズ・不透明度」で表現する(既存Canvas版ほど厳密である必要はない)。
- 音声反応・手動トリガー(既存と同じ3種):
  - 通常時: 疑似乱数(iベース)の位置に、`volume`でサイズ変化。
  - Radial Push(Trigger 1) — 発生中、パーティクルを中心から放射方向に一瞬押し出す(既存ロジック踏襲)。
  - Freeze(Trigger 2) — 発生中、パーティクル位置計算に使う時間経過を止める(既存ロジック踏襲)。
  - Color Flash(Trigger 3) — 発生中、パーティクル色を白に近づける(既存ロジック踏襲)。
- パレット: 既存同様、パーティクルごとにmain/sub間で補間。

### 型・共通コードの整理

- `src/scenes/_shared/types.ts`: `Scene2D` / `SceneContext2D` を削除する。`kind` フィールド(`"2d" | "webgl"`の区別)はもう分岐が存在しないため削除し、`SceneWebGL` → `Scene`、`SceneContextWebGL` → `SceneContext` として実質1本化する(名前は簡潔にするが、大規模なリネームによる影響を避けるため既存の `SceneFactory` 等の名前は維持する)。
- `src/layer.ts`: `Layer.canvas2d` / `Layer.ctx2d` を削除し、`canvasGl` のみにする。`updateLayerVisibility()`(2D/WebGL表示切り替え)は不要になるため削除。`renderLayer()` の `kind` 分岐を削除し、常にWebGL経路のみにする。
- `src/scenes/_shared/color-utils.ts`: `hsl()` はCanvas版Bar Spectrum専用だったため、置き換え後に使用箇所が無くなれば削除する(未使用コードを残さない)。
- `control.html` / `display.html`: canvas要素はJSで動的生成されており、HTML側の直接変更は無い見込み(念のため実装時に確認する)。

## 非機能要件

- 既存のシーン切替・カラーパレット・シーンプリセット・クロスフェード・複数投影窓・手動トリガー・マイク解析機能は引き続き問題なく動作すること。
- パフォーマンス(FPS)がCanvas版と同等以上であること(試作Bar Spectrum GLでの計測結果を踏襲)。
- 引き続きオフラインで動作すること。

## 受け入れ基準

- [x] Pulse Rings・Bar Spectrum・Noise Fieldの3シーンがWebGLで再実装され、既存と同じ名前・並び順でシーン選択に表示される
- [x] Pulse Rings・Noise Fieldの手動トリガー3種ずつが、Canvas版と同様に機能する
- [x] Bar Spectrumはカラーパレット非対応のまま(時間経過で色相が回転する配色)
- [x] 全9シーンで、パレット・シーンプリセット・クロスフェード・複数投影窓が問題なく動作する
- [x] `Scene2D` / `SceneContext2D` 型と、`Layer` の2D用canvas関連コードが削除され、`kind` によるレンダリング分岐が無くなる
- [x] 型チェック・ビルドがエラーなく通る
- [x] 複数投影窓・クロスフェード中を含め、FPSがCanvas版と同等(60fps安定)であることを確認する

## 実装メモ

- 型は仕様通り整理した。`src/scenes/_shared/types.ts` で `SceneContextBase`/`SceneContext2D`/`SceneContextWebGL` を `SceneContext` 1本に、`Scene2D`/`SceneWebGL` を `Scene` 1本に統合し、`kind` フィールドを削除した。既存6シーン(`04`〜`09`)は `sed` でimport文と型名を機械的に置換(`SceneContextWebGL`→`SceneContext`、`SceneWebGL`→`Scene`、`kind: "webgl",` の行を削除)して対応した。
- `src/layer.ts` から `canvas2d`/`ctx2d`/`updateLayerVisibility()` を削除。`resizeLayer()` は `renderer.setSize()` のみになり、`renderLayer()` の `kind` 分岐も無くなった。
- **Pulse Rings**(`01-pulse-rings.ts`): `TorusGeometry`(1個の共有ジオメトリを定常リング5個+Ring Burstの動的リングで使い回す、スケールで半径を表現)。`PerspectiveCamera` を使い、5個の定常リングをZ軸方向にわずかにずらして奥行きを出した。Ring Burstは新しい `THREE.Mesh`(material個別、geometry共有)を動的に生成し、寿命が尽きたら `renderScene.remove()` + `material.dispose()` する(共有geometryはdisposeしない)。
- **Bar Spectrum**(`02-bar-spectrum.ts`): 試作した `10-bar-spectrum-gl.ts` をそのまま統合し、シーン名を `"Bar Spectrum GL"` → `"Bar Spectrum"` に変更。`10-bar-spectrum-gl.ts` は削除。
- **Noise Field**(`03-noise-field.ts`): `Points` + `BufferGeometry`(`09-bloom-particles.ts` と同じ「毎フレーム`BufferAttribute`を書き換える」パターン、Bloomなし)。パーティクル数は450固定とし、`treble` に応じた可変カウントは「サイズ・不透明度への反映」に置き換えた(仕様通り)。Color Flash(Trigger 3)は、`lerpColor()` がhex文字列専用でrgb()文字列の二重補間ができないため(以前BPM機能で踏んだのと同じ制約)、`hexToRgb()` で成分を取り出しJS側でRGB値を直接計算している。
- `src/scenes/_shared/color-utils.ts` の `hsl()` は使用箇所が無くなったため削除した。
- 実機Chrome(開発サーバー、`window.open` を一時的にスタブ化してこの環境の制約を回避)で、Pulse Rings・Noise Fieldの手動トリガー3種ずつ・Bar Spectrumのトリガー無効化・複数投影窓(3投影窓、Feedback Loop/Noise Field/Bar Spectrum)でのクロスフェードを確認。FPS計測(`requestAnimationFrame` ベースの簡易カウンタ)は、単一投影窓・3投影窓同時(クロスフェード含め実質6レイヤー)とも60fps安定で、Canvas版時代と同等以上であることを確認した。
- 本文中の「Bar Spectrumはパレット非対応」は後日変更された。バー1本の幅を半分にし、位置に応じてmain→subへ線形補間するパレット対応シーンになった。手動トリガー非対応シーンの実例は [10-rainbow.ts](../src/scenes/10-rainbow.ts) が引き継いでいる。
