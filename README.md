# NoRigVJ

ブラウザで動作するインタラクティブなVJ(Visual Jockey)アプリケーション。
マイク入力の音声を解析し、リアルタイムでビジュアルを生成します。
特別なオーディオインターフェースやMIDI機材は不要です。

## セットアップ

```bash
npm install
npm run dev
```

表示されたURLの `/control.html` を開いてください(例: http://localhost:5173/control.html)。

## 構成

- **操作UI(control.html)** — マイク解析(全投影窓共通)・強度調整に加え、投影窓ごとのシーン選択・カラーパレット設定を行う画面。投影窓ごとにプレビュー付き。UI表記は英語です。
- **投影窓(display.html)** — 操作UIの「Add Display」ボタンから開く、ビジュアルのみのフルスクリーン画面。台数に制限はなく、それぞれ個別にシーン・配色を選べます。外部ディスプレイ/プロジェクタに表示します。

操作UIと各投影窓はブラウザの `BroadcastChannel` API で同期しており、同一PC・同一オリジン内で完結します。

## シーン

全シーンWebGL(three.js)で描画します。1シーン1ファイルで `src/scenes/` 配下に実装されており、ファイルを追加するだけで自動的にシーン選択の対象になります(以前はCanvas 2D APIとの併存構成でしたが、見た目・パフォーマンスの両面で優位なWebGLに統一しました)。

- **Pulse Rings** — 音量に反応する同心円(トーラス)。カラーパレット対応。
- **Bar Spectrum** — 低域でうねる3Dバー。バーの位置に応じてmain→subへ配色。カラーパレット対応。
- **Noise Field** — 高域で散らばるパーティクル群。カラーパレット対応。
- **Feedback Loop** — 前フレームの描画を歪ませながら重ねるフィードバックループ表現。カラーパレット対応。
- **Plasma Lava** — 複数のsin波を合成した古典的プラズマ/溶岩模様。カラーパレット対応。
- **Wireframe Polyhedron** — 回転する複数のワイヤーフレーム多面体。奥行きのある構図。カラーパレット対応。
- **Kaleidoscope** — 極座標の角度分割による万華鏡状の反復模様。カラーパレット対応。
- **Grid Terrain** — 音声で波打つワイヤーフレーム地形。奥行きのある見下ろし構図。カラーパレット対応。
- **Bloom Particles** — 発光(Bloom)する加算合成パーティクル群。カラーパレット対応。
- **Rainbow** — 画面いっぱいの虹色の平行線が上から下へ流れ続ける表現。虹の配色自体が特徴のため、カラーパレット非対応。
- **Starfield Warp** — 無数の星がカメラ手前へ流れ続けるワープ航法風の表現。カラーパレット対応。
- **Metaball Blob** — 有機的にうねる一塊の球体。カラーパレット対応。
- **Halftone Dots** — 格子状の円ドットが音声で拡縮する、印刷物のハーフトーン風グラフィック。カラーパレット対応。
- **Lissajous Lines** — リサージュ曲線を描く発光ライン。唯一の線画表現。カラーパレット対応。

## カラーパレット

投影窓ごとに、メイン/サブの2色からなるカラーパレットを設定できます。32種類のプリセットから選ぶか、カラーピッカーで自由に配色できます。プリセット選択のドロップダウンは各項目の左にmain/subの色見本が並んでおり、選ばなくても一覧から色味を確認できます。パレット非対応のシーン(Rainbow)を選んでいる間は、パレットUIが無効化されます。

## シーンプリセット

投影窓ごとの「シーン + カラーパレット」の組み合わせを名前付きで保存できます。保存したプリセットはどの投影窓からも呼び出せ、ブラウザの `localStorage` に保存されるためページを再読み込みしても残ります。強度は全投影窓共通の値のためプリセットには含まれません。保存時の名前入力欄には `{シーン名}-{メインカラー}-{サブカラー}`(例: `Pulse Rings-#ff00ff-#00ffff`)がデフォルト値として入っており、そのまま使うことも上書きすることもできます。

## シーン切替とクロスフェード

投影窓ごとのシーン選択・パレット設定・プリセット選択は、選んだだけでは表示に反映されません。これらはすべて「次に切り替える内容(予約)」を編集するもので、実際の切り替えは「Crossfade」ボタンを押すことで初めて起こります。現在の表示から予約した内容へ、指定時間(パネルの「Crossfade duration」スライダーで調整、全投影窓共通)かけて滑らかに遷移します。予約内容が現在の表示と同じ場合、ボタンは無効化されます。各投影窓行には「Current」のプレビューの隣に「Next」のプレビューも常時表示されるので、実行前に予約内容の見た目を確認できます。

## 手動トリガー演出

VJ本人がここぞという瞬間にボタン/キーで発火する、ワンショットの演出です(以前試みたBPM自動検出は精度不足で撤回、上記参照)。「Trigger 1」「Trigger 2」「Trigger 3」の3種類があり、押すと全投影窓(操作UIのプレビュー含む)が同時に反応します。どの演出を持つかはシーンごとに異なり、対応する演出が無いシーンを表示中はボタンが無効化されます(現時点で対応しているのはPulse Rings・Bar Spectrum・Noise Field・Feedback Loop・Wireframe Polyhedron・Kaleidoscope・Bloom Particles・Rainbow・Starfield Warp・Metaball Blob・Halftone Dots・Lissajous Linesの12シーン)。

- **Pulse Rings**: Trigger 1 = Ring Burst(リング新規生成して弾ける)/ Trigger 2 = Color Flip(配色を一瞬反転)/ Trigger 3 = Radius Kick(全リングを一瞬拡大)
- **Bar Spectrum**: Trigger 1 = Height Kick(全バーを一瞬伸ばす)/ Trigger 2 = Color Flip(配色を一瞬反転)/ Trigger 3 = White Flash(一瞬白く)
- **Noise Field**: Trigger 1 = Radial Push(パーティクルを放射状に押し出す)/ Trigger 2 = Freeze(一瞬静止)/ Trigger 3 = Color Flash(一瞬白く)
- **Feedback Loop**: Trigger 1 = Zoom Punch(渦の歪みを一瞬強める)/ Trigger 2 = Flash(中心の発光を一瞬強める)/ Trigger 3 = Invert(配色を一瞬反転)
- **Wireframe Polyhedron**: Trigger 1 = Spin Kick(回転速度を一瞬ブースト)/ Trigger 2 = Scale Pulse(全多面体を一瞬拡大)/ Trigger 3 = Flash(一瞬白く)
- **Kaleidoscope**: Trigger 1 = Segment Kick(分割数を一瞬増やす)/ Trigger 2 = Spin Burst(回転速度を一瞬ブースト)/ Trigger 3 = Flash(一瞬明るく)
- **Bloom Particles**: Trigger 1 = Radial Burst(パーティクルを放射状に押し出す)/ Trigger 2 = Bloom Flash(発光を一瞬強める)/ Trigger 3 = Freeze(一瞬静止)
- **Rainbow**: Trigger 1 = Monochrome(一瞬彩度を落としグレースケールに)/ Trigger 2 = Pale(一瞬淡く白へ)/ Trigger 3 = Darken(一瞬濃く黒へ)
- **Starfield Warp**: Trigger 1 = Warp Speed(一瞬速度を大幅ブースト)/ Trigger 2 = Flash(星を一瞬大きく白く)
- **Metaball Blob**: Trigger 1 = Spike(一瞬トゲトゲに変形)/ Trigger 2 = Smooth(一瞬真球に戻す)
- **Halftone Dots**: Trigger 1 = Invert(ドット/背景の配色を一瞬反転)/ Trigger 2 = Zoom(ドットの密度を一瞬変化)/ Trigger 3 = Flash(一瞬白く)
- **Lissajous Lines**: Trigger 1 = Ratio Kick(周波数比を一瞬変えて模様を歪ませる)/ Trigger 2 = Flash(一瞬白く発光)

## 操作方法(操作UI)

UI表記は英語です。

| キー / UI | 動作 |
|---|---|
| M / 「Enable Mic」/「Disable Mic」ボタン | マイク入力の有効・無効を切り替え(全投影窓共通) |
| ← / → / 「Intensity」スライダー | エフェクトの強度を調整(全投影窓共通) |
| 「Crossfade duration」スライダー | シーン切替の遷移時間を調整(全投影窓共通) |
| 投影窓ごとのシーン選択(セレクトボックス) | 次に切り替えるシーンを予約 |
| 投影窓ごとのパレット設定 | 次に切り替える配色をプリセット/カラーピッカーで予約 |
| 投影窓ごとの「Save Preset」/選択/「Delete」 | 現在のシーン+パレットを名前付きで保存/削除。呼び出すと予約に反映される |
| 投影窓ごとの「Crossfade」ボタン | 予約した内容へ実際に切り替える |
| Space / 「Trigger 1」ボタン | Trigger 1を発火(全投影窓共通) |
| Cmd右(Mac)/Ctrl右(Windows) / 「Trigger 2」ボタン | Trigger 2を発火(全投影窓共通) |
| Cmd左(Mac)/Ctrl左(Windows) / 「Trigger 3」ボタン | Trigger 3を発火(全投影窓共通) |
| F(投影窓側) | フルスクリーン切り替え |

## ビルド

```bash
npm run build
npm run preview
```

## 開発ドキュメント

実装の背景・設計判断は [specs/](specs/README.md) 配下の仕様書を参照してください。コードベース全体の案内は [CLAUDE.md](CLAUDE.md) にあります。

## 今後の拡張案

- BPM検出によるビート同期(2026-09-14に一度実装したが、検出精度が実用に耐えず撤回。再挑戦する場合はよりロバストな検出アルゴリズムの検討が必要)
