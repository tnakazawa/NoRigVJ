# 015: FXパッド(XY連続操作)への置き換え

- ステータス: Implemented
- 作成日: 2026-09-19

## 背景・目的

[specs/007-manual-trigger.md](007-manual-trigger.md)で追加したTrigger 1/2/3は「押すと発火→時間経過で減衰」という単発演出だった。これを、タッチパネルのような四角い操作面(以下FXパッド)に置き換える。VJは面の中の位置(押している間の座標)で演出の種類と強さを連続的にコントロールできるようになり、押す/離すだけだったTriggerより表現の自由度が上がる。

Trigger 1/2/3は全33シーン中30シーンに個別のエフェクト実装を持つ大掛かりな機能だが、今回はFXパッドへの完全置き換えとし、Triggerのボタン・キー割当・型・全30シーン分のエフェクト実装コードを削除する。全シーンをFXパッド対応にし直すのは大工事のため、今回はまず仕組みを作り、少数シーンだけ新エフェクトを実装して動作を確認する(残りのシーンは今回未対応のままにし、後日追加していく)。

## 要件

### 配置とUI

- 新規UI「FXパッド」を `#main-area` 内、`#displays-list` の下部に1つだけ新設する(投影窓の数に関わらず常に1個。投影窓ごとには増えない)。水平方向は中央揃え。
- 正方形ではなく、広すぎない横長の長方形。中心を(0, 0)、左上を(-1, -1)、右下を(1, 1)として、中心から離れるほど値の絶対値が大きくなることが視覚的に分かるヒント(中心が暗く外側が明るい放射グラデーション等)を付ける。中心の位置を示す小さなマーカーを常時表示する。
- 現在押されている位置にポインタ(ドット等)を表示する。
- `#displays-list`との境目にドラッグ可能なリサイズハンドルを設け、パッドエリアの高さを調整できるようにする。設定した高さは`localStorage`に保存し、次回起動時も復元する。

### 操作方法

- クリック(pointerdown)した位置がその瞬間のX,Y値になる。
- そのままドラッグ(pointermove)すると、Pointer Captureを使って要素外に出てもドラッグを継続し、位置に追従してX,Yがリアルタイムに更新される(パッド外に出た分は-1〜1にクランプする)。
- pointerup、またはpointercancel(ドラッグ中にウィンドウ外に出て離した場合等)で、値は即座に0(中心、未操作)に戻る。

### 値の伝搬

- 値は全投影窓共通(Trigger同様、投影窓ごとの個別値は持たない)。
- `VJState`(BroadcastChannel経由)に新フィールドを追加し、`tick()`から毎フレーム現在のX,Yをそのまま送信する(Triggerのような「発火idを検知して自分で減衰計算する」方式ではなく、操作側の現在値をそのまま流し込む方式にする — 連続値なので減衰の概念がなく、この方が単純なため)。
- 未操作時は(0, 0)(中心)を送信する。

### 有効/無効

- 表示中のいずれの投影窓もFXパッド対応のシーンでない場合、パッド自体を無効化する(操作不能・見た目を薄くする。Triggerボタンの無効化ロジックを踏襲)。
- 投影窓が1つもない場合も無効化する。

### 型・データ構造の置き換え

- `SceneContext`(`src/scenes/_shared/types.ts`)の`triggers: [number, number, number]`を削除し、代わりに`padX: number` / `padY: number`(共に-1〜1、中心(0,0)、未操作時0)を追加する。
- `Scene.triggerEffectNames?: TriggerEffectNames`・`TriggerEffectNames`型を削除し、代わりに`Scene.padSupported?: boolean`(そのシーンがFXパッドに対応した演出を持つかどうか)を追加する。
- `VJState.trigger`・`TriggerInstruction`(`src/shared.ts`)を削除し、代わりに`VJState.pad: { x: number; y: number }`を追加する。
- `SceneContextBase.triggers`を参照している既存30シーンの実装(Ring Burst、Color Flip等)は、対応する演出をFXパッド用に作り直す対象(下記「初回対応シーン」)を除き削除する。

### 既存Triggerの削除範囲

- パネルの「Trigger」見出し・Trigger 1/2/3ボタン
- キー割当: Space、Cmd右(`MetaRight`)/Ctrl右(`ControlRight`)、Cmd左(`MetaLeft`)/Ctrl左(`ControlLeft`)
- `updateTriggerButtonStates()`・`computeTriggers()`・`triggerFiredAt`・`TRIGGER_PULSE_DECAY_TAU`(control.ts/display.ts双方)
- 30シーン分の`triggerEffectNames`実装コード(初回対応シーンとして作り直す分は除く)

### 初回対応シーン(仕組みの動作確認用)

以下3シーンにFXパッド対応の新エフェクトを実装する。他のシーンは今回未対応のままとする。

- **Pulse Rings**: X = メイン/サブカラーの補間を反転させる度合い(中心からの絶対値を使うため左右対称、Color Flipの連続版)。Y = 全リングの半径オフセット(正で膨らむ、負で縮む、Radius Kickの連続版)。
- **Bar Spectrum**: X = 配色反転の度合い(絶対値、左右対称)。Y = バーの高さブースト(正で伸びる、負で縮む、Height Kickの連続版)。
- **Noise Field**: X = 正で白へ、負で黒へ寄せる(符号で方向が変わる、Color Flashの連続版)。Y = パーティクルを中心から放射方向へ押し出す強さ(正で押し出す、負で中心へ引き寄せる、Radial Pushの連続版)。

## 非機能要件

- 既存のシーン切替・カラーパレット・シーンプリセット・クロスフェード・複数投影窓・マイク解析・フルオート/シーケンスモードは引き続き問題なく動作すること。
- 引き続きオフラインで動作すること。

## 受け入れ基準

- [x] `#displays-list`の下に、投影窓の数に関わらず1つのFXパッドUIが表示される
- [x] パッド上でクリック・ドラッグすると、押している位置に応じたX,Y値がリアルタイムに全投影窓(操作UIのプレビュー含む)へ伝わる
- [x] パッド外へドラッグしても0〜1にクランプされた値になる(エラーにならない)
- [x] 指を離す(pointerup/pointercancel)と値が即座に0に戻る
- [x] 表示中のいずれの投影窓もFXパッド対応シーンでない場合、パッドが無効化される。投影窓が1つもない場合も無効化される
- [x] Pulse Rings/Bar Spectrum/Noise Fieldの3シーンで、X軸・Y軸それぞれの操作に応じて意図した視覚効果が変化する
- [x] 既存のTrigger 1/2/3ボタン・見出し・キー割当が画面上・キーボード操作から削除されている
- [x] `00-blank.ts`(何も描画しないため対応不可)を除く全32シーンにFXパッド演出が実装されている(初回は3シーンのみだったが、複数回の追加対応で残り29シーンすべてに拡大した)
- [x] 既存のシーン切替・カラーパレット・シーンプリセット・クロスフェード・複数投影窓・マイク解析・フルオート/シーケンスモードは引き続き問題なく動作する
- [x] `#displays-list`との境目のハンドルをドラッグすると、パッドエリアの高さがアスペクト比を保ったまま変化する。設定した高さはページ再読み込み後も維持される

## 実装メモ

`src/scenes/_shared/types.ts`の`SceneContext.triggers`を`padX`/`padY`(共に0〜1)に、`Scene.triggerEffectNames?`を`Scene.padSupported?: boolean`に置き換えた。`src/shared.ts`は`TriggerInstruction`/`VJState.trigger`を削除し`PadState`/`VJState.pad: { x, y }`を新設。`layer.ts`の`createLayer()`/`renderLayer()`のシグネチャもtriggers配列からpadX/padYの2引数に変更した。

`control.ts`側は`fxPadEl`(`#fx-pad`)に`pointerdown`/`pointermove`/`pointerup`/`pointercancel`を張り、`pointerdown`で`setPointerCapture()`することでパッド外へドラッグしても追従できるようにした(`pointerToPad()`でクランプ込みの正規化座標を計算)。`pointerup`/`pointercancel`で即座に`padX`/`padY`を0に戻す(Triggerのような減衰計算は不要になり、`tick()`は現在値をそのまま`VJState.pad`に詰めて送るだけになった)。`updateFxPadEnabled()`が`tick()`から毎回呼ばれ、表示中投影窓のいずれかが`scene.padSupported`を持つかどうかで`#fx-pad`に`.disabled`クラスを付け外しする。`display.ts`側は`latest.pad.x`/`latest.pad.y`をそのまま`renderLayer()`に渡すだけになり、Trigger時代にあった`computeTriggers()`・`triggerFiredAt`・`TRIGGER_PULSE_DECAY_TAU`は両ファイルから削除した。

`control.html`は`#displays-list`の下に`#fx-pad-section`(見出し・ヘルプボタン・`#fx-pad`本体・軸ラベル)を新設。`#fx-pad`は`linear-gradient(135deg, #1a1a1a, #2d6a4f)`で左上(暗)→右下(緑)のヒントを付け、`#fx-pad-dot`(絶対配置の小さな丸)で現在位置を表示する(`pointerup`/`pointercancel`で`hidden = true`)。パネル側の「Trigger」見出し・Trigger 1/2/3ボタン・`.trigger-btn`スタイルは削除した。

Pulse Rings/Bar Spectrum/Noise Fieldの3シーンは、元のTrigger実装(離散的な「発生中は〜」という閾値判定)を、`padX`/`padY`(0〜1の連続値)による線形補間に作り直した。例えばPulse RingsのColor Flipは`colorT = baseT + (1 - 2*baseT) * padX`とし、`padX=0`で元の配色、`padX=1`で完全反転、中間値では滑らかに補間されるようにした。残り30シーンは、Triggerだった頃のコード(uniform宣言・JS側の計算・冒頭コメントの「手動トリガー◯種対応」)をすべて削除し、Trigger導入前の見た目に戻した(`padSupported`は付けていない)。この27シーン分の機械的な削除作業はサブエージェントに分担させ、完了後に差分を目視レビューして`npx tsc --noEmit`のエラーが0件になることを確認した。

ブラウザ実機(開発サーバー、`window.open`を一時的にスタブ化してこの環境の制約を回避)で、投影窓を1つ追加しPulse Ringsを表示した状態で、パッド右下(X=0.9, Y=0.9相当)を押すと配色が反転しリングが膨らむこと、左上を押すと元の配色・元の半径のままであること、指を離すと即座に元に戻ることを確認した。また実際のマウスドラッグ(`left_click_drag`)でも`setPointerCapture`関連のエラーが出ないことを確認した(合成`PointerEvent`を直接dispatchするテスト方法では`setPointerCapture`が`NotFoundError`を投げるが、これはブラウザの制約でテスト手法起因のものであり実際のポインタ操作では発生しない)。Blankシーン(パッド非対応)に切り替えるとパッドが自動的に無効化されることも確認した。

[specs/007-manual-trigger.md](007-manual-trigger.md)はこの仕様により置き換えられたため、ステータスを「Replaced by 015」に更新した。

### 追加修正: 座標系を中心(0,0)基準に変更、レイアウト調整

初回実装は左上(0,0)・右下(1,1)の座標系だったが、「左上をネガティブ方向として扱いたい(中心が0,0)」との要望を受け、中心(0,0)・左上(-1,-1)・右下(1,1)に変更した。

- `pointerToPad()`(control.ts)を`x = (相対位置) * 2 - 1`に変更し、-1〜1にクランプする。未操作時の値(0, 0)は変更していないが、これが「中心」と一致するようになった点が変更の要(離すと中心に戻る、という自然な対応になった)。
- `setPad()`のドット位置計算を`((値+1)/2)*100%`に変更(中心基準からCSSの0〜100%表現へ変換)。
- 型定義(`SceneContext.padX/padY`、`PadState`)のコメントを-1〜1・中心(0,0)に更新。
- 3シーンの計算式を「量的なエフェクト(半径・高さ・押し出し強さ)は符号をそのまま使い、正負で方向が変わる」「比率的なエフェクト(色の反転度合い)は絶対値を使い、中心からの距離だけが効く左右対称な演出にする」という2パターンに整理し直した。Bar SpectrumのY(高さ)は負の値で高さが0を下回りうるため`Math.max(0.05, ...)`のクランプを追加。Noise FieldのX(白/黒フラッシュ)は符号で「正なら白へ、負なら黒へ」線形補間する対称式に、Y(押し出し)の発動条件も`Math.abs(push) > 0.01`に変更した(以前は正のみ判定していた)。

続けて「FXパッドを左側の中心に配置。正方形ではなく広すぎない長方形で」「見出しの文字を左詰め、?を右詰めにしてその分パッドの高さを稼ぎたい」「?も左詰めで見出し文字の右に隣接配置」という調整依頼を受け、UIを次のように変更した。

- `#fx-pad`を正方形(1:1)から横長の長方形(最終的に`aspect-ratio: 1.8 / 1`)に変更し、`#fx-pad-section`を`align-items: center`にして水平方向中央揃えにした(垂直位置は`#displays-list`の下のまま)。
- 背景を対角グラデーション(`linear-gradient(135deg, ...)`)から中心対称の放射グラデーション(`radial-gradient(ellipse at center, #1a1a1a, #2d6a4f)`)に変更し、「中心が弱い(暗い)・外側が強い(濃い)」ヒントにした。中心位置を示す小さな丸(`#fx-pad-center`、`pointer-events: none`)を常時表示に追加した。
- 軸ラベル(`.fx-pad-axis-labels`、「Y ↓ stronger」等)は横長レイアウトと相性が悪いため削除し、説明はヘルプモーダルの文言に一本化した。
- 見出し行(`.fx-pad-header`)は最終的に`justify-content`を指定しない素朴なflex行(`strong`→`button`の順で隣接配置、共に左詰め)にした。`#fx-pad-section`の`padding`/`gap`も詰めて、浮いた分をパッド本体の高さに回している。
- 見出し行自体は`align-self: flex-start`で`#fx-pad-section`の`align-items: center`から外し、パッド本体は中央のまま、見出し行だけ画面左端(パネルのpaddingの内側)まで寄せた(「ここまで左寄せにしたい」という具体的なスクリーンショット付き指示を受けて調整)。
- ヘルプの説明文(`data-help`)も新しい座標系(中心が0、逆方向で符号反転)に合わせて書き直した。

### 追加修正: パッドを大きく、高さをドラッグで調整可能に

「もっと高さを伸ばして」という指示(具体的にどこまで伸ばしたいかをスクリーンショットの矢印で指示された)を受け、`#fx-pad-section`を`flex: 0 0 auto`にして明示的な`height`(px)を持たせ、`#displays-list`との境目に`#fx-pad-resize-handle`(高さ8pxのドラッグハンドル、`cursor: row-resize`)を新設した。

- パッド本体(`#fx-pad`)のサイズ決定は、単純な`width: 100%; aspect-ratio`ではアスペクト比を保ったまま利用可能な高さいっぱいに広がってくれなかった(`flex-grow`で確保した高さと`aspect-ratio`が競合し、幅の制約だけが効いて縦長に潰れてしまう挙動を確認)。そのため`#fx-pad-body`(`#fx-pad`の親、`#fx-pad-header`の下で残りスペース全部を占める)に`container-type: size`を指定し、`#fx-pad`の`width`/`height`を`min(100cqw, 100cqh * 1.8)` / `min(100cqh, 100cqw / 1.8)`という式にした。これはコンテナクエリ単位(`cqw`/`cqh` = コンテナの幅・高さの1%)を使い、幅・高さのどちらの制約が厳しくても`1.8:1`のアスペクト比を保ったまま最大化する、画像の`object-fit: contain`相当の効果をCSSだけで実現する手法。
- `#fx-pad-resize-handle`の`pointerdown`/`pointermove`(Pointer Capture使用)/`pointerup`で`#fx-pad-section`の`height`をpxで直接書き換える(`setFxPadSectionHeight()`)。上方向へドラッグする(`clientY`が減る)ほど高さが増える。最小`120px`・最大は`window.innerHeight * 0.8`にクランプする。
- 高さは`localStorage`(`norigvj-fx-pad-section-height`)に保存し、ページ再読み込み後も維持する(`sequence.ts`の永続化と同じ考え方)。デフォルト高さは`280px`。

ブラウザ実機で、ハンドルを上方向へドラッグするとパッドが大きくなり(アスペクト比`1.8:1`を保ったまま)、リロード後も設定した高さが復元されることを確認した。

ブラウザ実機で、右下方向へドラッグすると配色反転・リング拡大、左上方向(X,Y共に負)へドラッグするとリング縮小(Y軸の符号反転は明確に確認、X軸は絶対値ベースのため左右対称で見た目上の変化は左右で同じになる、これは意図した設計)することを確認した。また実マウスドラッグ(`left_click_drag`)でも新しいレイアウト・座標系でエラーが出ないことを確認した。

### 追加対応: 9シーンへの拡大

初回実装(Pulse Rings/Bar Spectrum/Noise Fieldの3シーン)に続き、以下9シーンにもFXパッド対応の演出を追加した(`padSupported: true`)。対応済みは合計12/33シーンになった。各シーンとも、`main`ブランチに残っていたTrigger実装(`git show main:src/scenes/<ファイル名>`で参照)の計算式をベースに、押している間だけ発火する離散値(`triggers[n]`、0〜1で発生中のみ増加・減衰)を、`padX`/`padY`(-1〜1、中心0)による連続値へ作り直した。

- **Voronoi Cells**: X = 格子密度オフセット(`padX`そのまま、正で密に細かいセルへ・負で粗く大きいセルへ、`clamp()`で密度が0以下や極端に粗くなりすぎないよう範囲を絞った、Shuffleの連続版)。Y = 白(正)/黒(負)へ寄せる対称式(Flashの連続版)。
- **Instanced Cube Grid**: X = 白(正)/黒(負)へ寄せる対称式(White Flashの連続版)。Y = 全キューブの高さオフセット(`padY`そのまま、正で伸びる・負で縮む、Height Kickの連続版)。3つ目のトリガーだったWave Pulse(波紋の振幅増幅)はHeight Kickと見た目の効果が近く、2軸に収めるにあたり優先度を下げて見送った。
- **Matrix Rain**: X = 列の流れ速度オフセット(`padX`そのまま、正で加速・負で減速、`max()`で速度が0付近まで下がりきらないようクランプ、Speed Burstの連続版)。Y = 白(正)/黒(負)へ寄せる対称式(Flashの連続版)。
- **DNA Helix**: X = 回転速度オフセット(`padX`そのまま、正で加速・負で逆回転、Spin Kickの連続版)。Y = 螺旋の半径オフセット(`padY`そのまま、正で膨らむ・負で縮む、`Math.max()`で半径が0以下にならないようクランプ、Radius Pulseの連続版)。3つ目のトリガーだったFlash(白へ寄せる)はX/Yの2軸をすでに使い切っているため見送った。
- **Fireworks**: X = 爆発の初速オフセット(`padX`そのまま、正でより勢いよく・負でよりゆっくり、`Math.max()`で初速が0以下にならないようクランプ、Launch Burstの連続版)。Y = 白(正)/黒(負)へ寄せる対称式(Flashの連続版)。Launch Burstは元々「押すと発火する単発演出」だが、花火自体が周期的に発生し続ける仕組み(shellごとに位相をずらして常時どこかが爆発中)であり、初速というパラメータ自体は常に有効な連続値のため、パッドを押している間の勢い調整として自然に連続値化できた。
- **Fresnel Glass Sphere**: X = 輪郭の発光(フレネル項)オフセット(`padX`そのまま、正で強調・負で控えめに、Glow Burstの連続版)。Y = 中心部を白(正)/黒(負)へ寄せる対称式(Core Flashの連続版。不透明度にも`Math.abs(padY)`を加算し、白方向・黒方向どちらでも存在感が増すようにした)。
- **Radial Rays**: X = 回転速度オフセット(`padX`そのまま、正で加速・負で逆回転、Spinの連続版)。Y = 発光範囲オフセット(`padY`そのまま、正で広げる・負で狭める、`clamp()`で範囲が0以下や過大にならないよう制限、Burstの連続版)。
- **Aurora**: X = 波の振幅オフセット(`padX`そのまま、正で激しく・負で穏やかに、`clamp()`で振幅が負にならないよう制限、Rippleの連続版)。Y = 発光強度オフセット(`padY`そのまま、正で明るく・負で暗く、`clamp()`で明るさが負にならないよう制限、Brightenの連続版)。
- **Spiral Galaxy**: X = 回転速度オフセット(`padX`そのまま、正で加速・負で逆回転、Spin Burstの連続版)。Y = 白(正)/黒(負)へ寄せる対称式(Flashの連続版)。

白/黒フラッシュ系(Voronoi Cells・Matrix Rain・Fireworks・Spiral Galaxyの各Y軸、Instanced Cube GridのX軸、Fresnel Glass SphereのY軸)は、既存の`03-noise-field.ts`と同じ対称式(`flash >= 0`なら白へ、`flash < 0`なら黒へ線形補間)を踏襲した。フルスクリーンquadシェーダーのシーン(Voronoi Cells/Matrix Rain/Radial Rays/Aurora/Fresnel Glass Sphere)はGLSL側に`if (uFlash >= 0.0) { ... } else { ... }`という同等の分岐を追加し、`uMainColor`等と同じパターンで新規uniform(`uShuffle`/`uFlash`/`uSpeedBoost`/`uSpin`/`uBurst`/`uRipple`/`uBrighten`/`uGlowBurst`/`uCoreFlash`)を追加した。

`npx tsc --noEmit`で型エラー0件を確認した。

### 追加対応: Flocking Boids等9シーンへの拡大

Voronoi Cells等9シーンへの拡大に続き、`24-flocking-boids.ts`〜`32-ribbon-wave.ts`(Flocking Boids/Bouncing Balls/Chladni Patterns/Sacred Geometry Mandala/Lightning Arcs/Glitch Blocks/Radial Bar Spectrum/Origami Folding Planes/Ribbon Wave)の9シーンにFXパッド対応を追加した。対応済みは合計21/33シーンになった。以前これらのシーンが持っていたTrigger演出(`git show main:src/scenes/<file>.ts`で参照可能)を土台に、以下の方針で連続値化した。

- X軸は9シーン中8シーンで「正で白へ・負で黒へ寄せる」対称式(Noise Fieldと同じFlashパターン)に統一した。Radial Bar Spectrumのみ、Bar Spectrum(01)と設計を揃えるため`Math.abs(padX)`によるColor Flipにした。
- Y軸は各シーン固有の量的エフェクト1つを`padY`の正負両方向にそのまま(または`Math.max(0, ...)`で正負に分けて)割り当てた: Flocking Boidsは分離力(Scatter、正)と結合力(Gather、負)を1軸に統合、Chladni Patternsは振動モードのオフセット、Sacred Geometry Mandalaは半径(Bloom)、Glitch Blocksはグリッチしきい値(Corrupt)、Radial Bar Spectrumはバー長さ(Height Kick)、Ribbon Waveはうねり振幅(Wave Kick)。
- 「発生した瞬間だけ一瞬起きる」性質で連続値と相性が悪いワンショット演出は、以下のように作り直すか見送った:
  - Bouncing BallsのBounce Burst(立ち上がり検出で1回だけ上向き速度を与える)は、「押している間ジャンプの発生確率と強さを連続的に上げる」演出に作り直した(正でジャンプ頻度・跳ねる高さが増す、負は逆に重力を強めて沈み込ませる対になる方向を新設)。
  - Lightning ArcsのStrike(強制的に全bolt発生)は、「稲妻が見えている時間の長さ」を連続的に伸縮する演出に作り直した(正で可視時間を最大21倍まで伸ばしほぼ常時発生に見せる、負で可視時間を短くして消えていく)。
  - Origami Folding PlanesのFold(最大)/Flatten(0)という別々のワンショット2つは、「両端の状態を作る1本の軸」として`padY`の正負に統合した(ユーザー指示で好例として挙げられたパターン)。
  - Sacred Geometry MandalaのSpin Burst(回転速度ブースト)は、2軸(X=Flash、Y=Bloom)で既に手一杯のため見送った。Radial Bar SpectrumのWhite Flashも同様に見送った(Height Kick/Color Flipの2軸で01-pulse-rings.ts・02-bar-spectrum.tsと設計を揃えることを優先した)。

実装完了後、`npx tsc --noEmit`で対象9ファイルに関する型エラーが0件であることを確認した。

### 追加対応: 残り全シーンへの拡大(05・08含む、全32シーン完了)

「他のシーンもFXPadに対応させて」という依頼を受け、上記までで対応した21シーン(01/02/03 + Voronoi Cells等9シーン + Flocking Boids等9シーン)に加え、`04-feedback-loop.ts`・`06-wireframe-polyhedron.ts`・`07-kaleidoscope.ts`・`09-bloom-particles.ts`・`10-rainbow.ts`・`11-starfield-warp.ts`・`12-metaball-blob.ts`・`13-halftone-dots.ts`・`14-lissajous-lines.ts`の9シーン(サブエージェント1グループが担当)、および`05-plasma-lava.ts`・`08-grid-terrain.ts`の2シーン(Claude本体が直接実装)にもFXパッド対応を追加した。これで`00-blank.ts`(何も描画しないため対応不可)を除く全32シーンの対応が完了した。

- `04-feedback-loop.ts`: X = 前フレーム配色の反転度合い(`Math.abs(padX)`、Invertの連続版)。Y = 前フレームの歪み量オフセット(`padY`そのまま、Zoom Punchの連続版)。Flash(発光増幅)は「動き」と「色」の2軸で手一杯のため見送った。
- `06-wireframe-polyhedron.ts`: X = 回転速度オフセット(Spin Kickの連続版、正負を跨ぐと逆回転)。Y = 白/黒フラッシュ対称式(Flashの連続版)。Scale Pulseは既存のbass反応スケールと役割が近いため見送った。
- `07-kaleidoscope.ts`: X = 分割数オフセット(Segment Kickの連続版、最小3分割にクランプ)。Y = 明るさオフセット(Flashの連続版)。Spin Burstは既存のtreble反応回転と役割が近いため見送った。
- `09-bloom-particles.ts`: X = 放射方向オフセット(Radial Burstの連続版、正で押し出し・負で引き寄せ)。Y = 揺れの時間経過速度(`timeScale = max(0, 1 + padY)`、Freezeの連続版、負に倒すほど停止に近づく)。Bloom Flashは既存のvolume反応Bloomと概念が近いため見送った。
- `10-rainbow.ts`: X = グレースケール化度合い(`Math.abs(padX)`、Monochromeの連続版)。Y = 白(正)/黒(負)へ寄せる対称式(Pale/Darkenの連続版)。3種のTriggerのうち対になる2つ(Pale/Darken)を1軸に統合できた好例。
- `11-starfield-warp.ts`: X = 前進速度オフセット(Warp Speedの連続版)。Y = 白/黒フラッシュ対称式、サイズも変化(Flashの連続版)。
- `12-metaball-blob.ts`: Y = 変位量オフセット(Spike/Smoothの連続版、正で変位増幅・負で真球化)。ちょうど逆方向だった2つのワンショットを1軸に統合できた。X軸に自然に対応する演出が見当たらず意図的に未使用。
- `13-halftone-dots.ts`: X = ドット/背景の配色反転度合い(`Math.abs(padX)`、Invertの連続版)。Y = グリッドの細かさオフセット(Zoomの連続版、分母を0.25以上にクランプ)。Flashは色反転+密度変化の方が差別化できるため見送った。
- `14-lissajous-lines.ts`: X = 周波数比オフセット(Ratio Kickの連続版、0.5を下限にクランプ)。Y = 白/黒フラッシュ対称式(Flashの連続版)。
- `05-plasma-lava.ts`(元々Trigger非対応): X = 模様の細かさ(周波数)オフセット、正で細かく・負で粗く。Y = 明るさオフセット、正で明るく・負で暗く。新規にFXパッド用の演出を考案した。
- `08-grid-terrain.ts`(元々Trigger非対応): X = 地形の起伏(振幅)オフセット、正で激しく・負で平坦に近づく。Y = 配色の基準オフセット、正でsub寄り・負でmain寄りに全体をシフト。新規にFXパッド用の演出を考案した。

白/黒フラッシュ系のY軸(または対称式のX軸)は、引き続き`03-noise-field.ts`と同じ`flash >= 0`で白へ・`flash < 0`で黒へ線形補間する対称式を踏襲している。

作業は3グループに分けたサブエージェントへ並行して依頼し(9シーンずつ)、Claude本体は`05-plasma-lava.ts`・`08-grid-terrain.ts`(元々Trigger非対応で参考実装がなかったため)を直接実装した。全作業完了後、`npx tsc --noEmit`・`npm run build`ともにエラー0件を確認した。`README.md`・`src/CLAUDE.md`・`src/scenes/CLAUDE.md`も、各サブエージェントが担当分を更新した後、最終的に全32シーン分の一覧・件数の整合性をClaude本体が確認・統合した(複数エージェントが同時にドキュメントを編集したため、シーン一覧が担当分ごとに部分的にしか反映されていない箇所があり、まとめ直す必要があった)。

**見送った演出のまとめ(ユーザー確認用)**: 以下は「3つ目のTrigger」や「2軸に収まらない演出」を意図的に見送ったケース。優先度を変えたい場合は個別に調整可能。
- Instanced Cube Grid: Wave Pulse(波紋振幅増幅)を見送り、Height Kickのみ採用
- DNA Helix: Flash(白へ寄せる)を見送り、Spin Kick/Radius Pulseのみ採用
- Sacred Geometry Mandala: Spin Burst(回転速度ブースト)を見送り、Flash/Bloomのみ採用
- Radial Bar Spectrum: White Flashを見送り、Color Flip/Height Kickのみ採用(01/02と設計を揃えた)
- Feedback Loop: Flash(中心発光増幅)を見送り、Invert/Zoom Punchのみ採用
- Wireframe Polyhedron: Scale Pulse(一時拡大)を見送り、Spin Kick/Flashのみ採用
- Kaleidoscope: Spin Burst(回転速度ブースト)を見送り、Segment Kick/Flashのみ採用
- Bloom Particles: Bloom Flash(発光増幅)を見送り、Radial Burst/Freezeのみ採用
- Halftone Dots: Flashを見送り、Invert/Zoomのみ採用

また、「発生した瞬間だけ一瞬起きる」ワンショット演出は、連続値に自然に作り直せた場合はそのまま採用し(Bouncing BallsのBounce Burst→ジャンプ頻度・重力の連続調整、Lightning ArcsのStrike→可視時間の伸縮)、Origami Folding PlanesのFold/Flattenのように「両端の状態」として自然に1軸へ統合できるケースはそのパターンを踏襲した。

### 追加修正: 感度調整・見た目の底上げ

全シーン対応後、実機で試した上でのフィードバックを受け、複数シーンのFX感度・無操作時の見た目を調整した。

- **Pulse Rings**: Y軸(半径オフセット)の係数を`1.5`→`5`に上げ、右下方向を強く押すとリングが画面をはみ出すレベルまで大きくなるようにした(「はみ出してよい」旨の指示のため許容)。
- **Bar Spectrum**: 「画面下部が寂しい」との指摘を受け、バーの底辺位置を`-1.5`→`-3`(画面下寄り)に変更。音声反応の可動幅(`level`係数`4→6`)とY軸(高さオフセット、`3→6`)も拡大し、右下方向の効きを強くした。
- **Feedback Loop**: X軸(前フレーム配色反転)が、フィードバック構造上わずかな入力でも反転が毎フレーム累積し急速に画面全体が反転してしまうほど敏感だったため、`pow(abs(padX), 3.0)`にして中心付近の感度を大きく下げた。
- **Kaleidoscope**: Y軸(明るさオフセット)の係数を`2.0`→`0.7`に下げ、少し動かしただけで白飛び/暗転しすぎないようにした。
- **Fresnel Glass Sphere**: 操作なし時の動きが乏しかったため、回転速度を上げ(`0.2→0.4`、`0.1→0.25`)、常時ゆっくり脈動する呼吸のようなスケール変化(`1 + sin(time*1.4)*0.08 + bass*0.1`)を追加した。X軸(輪郭発光)は負方向(左)の係数が強すぎ、パッドを少し左へ動かしただけで発光が完全に消えていたため、正負で係数を分け(正2.5・負0.8)、下限もクランプして完全消失を防いだ。
- **Aurora**: Y軸(発光強度)が負方向(上)に強く振れすぎ、少し動かすと真っ暗になっていたため、Fresnel Glass Sphereと同様に正負で係数を分け(正2.0・負0.6)、下限をクランプした。
- **Flocking Boids**: 動きが単調で他のパーティクル系シーンと似た印象だったため、最大速度(`1.8→3.2`)・分離力(`1.5→2.2`基準)・整列力(`0.5→0.9`)・結合力(`0.3→0.5`基準)を全体的に強めた。またGather(結合、Y軸負方向)を強めたときに、近傍のboid同士を線で結ぶ`THREE.LineSegments`を追加し、Scatter(分離)との違いが見た目でも分かるようにした(最大260本まで、結合の強さに応じて線の不透明度が上がる)。
- **Lightning Arcs**: 黒ベタが多く貧弱だったため、稲妻の本数を`4→12`(3倍)に増やした。線の太さも、`THREE.LineBasicMaterial`の`linewidth`がほとんどのブラウザで1固定される制限([src/scenes/CLAUDE.md](../src/scenes/CLAUDE.md)の既知の注意点参照)のため、Fat Lines(`three/examples/jsm/lines/{Line2,LineGeometry,LineMaterial}`)に置き換えて`linewidth: 3.5`(ピクセル単位)を指定した。`LineMaterial`は`resolution`をcanvasサイズに合わせて毎フレーム更新する必要がある。
- **Origami Folding Planes**: 動きが少なかったため、`mesh.rotation.y = ctx.time * 0.5`で常時Y軸回転させ続けるようにした(以前は初期回転が固定値のみで、折れ角度の変化以外に動きがなかった)。
- **Ribbon Wave**: 黒ベタが多く貧弱だったため、チューブの半径を`0.18`→`0.36`(2倍)にした(`TUBE_RADIUS`定数として抽出)。
