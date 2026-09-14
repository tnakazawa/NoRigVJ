# 007: 手動トリガー演出

- ステータス: Implemented
- 作成日: 2026-09-14

## 背景・目的

以前BPM検出によるビート同期を試みたが、検出精度が実用に耐えず撤回した(README.md「今後の拡張案」参照)。自動検出の代わりに、VJ本人がここぞという瞬間にボタン/キーで手動発火する「ワンショット演出」を用意する。自動検出より確実に狙ったタイミングで演出を出せる。

## 要件

### トリガーは3種類、シーンごとに対応を選べる

- 手動トリガーは **Trigger 1 / Trigger 2 / Trigger 3** の3種類を固定で用意する。
- どの演出を実装するかはシーンごとに自由(0〜3種類)。今回実装するのは以下の2シーンのみ:
  - **Pulse Rings**: Trigger 1 = Ring Burst / Trigger 2 = Color Flip / Trigger 3 = Radius Kick
  - **Noise Field**: Trigger 1 = Radial Push / Trigger 2 = Freeze / Trigger 3 = Color Flash
- Bar Spectrum・Feedback Loopは今回は非対応(0種類)のままとする。後日追加可能な設計にしておく。

### トリガー方法

- 操作UIのパネルに「Trigger 1」「Trigger 2」「Trigger 3」の3つのボタンを設置する。
- キーボードショートカットとして `1` `2` `3` キーを割り当てる(数字キーによるシーン切替は既に廃止済みのため空いている)。ただしプリセットselectなど他のフォーム要素にフォーカスがある間は、ブラウザ標準の入力を優先し誤発火させない。

### ボタンの有効/無効

- 現在何らかの投影窓が開いており、かつその投影窓のうち **1つ以上** が押そうとしているトリガー番号に対応する演出を持つシーンを表示中であれば、そのボタンは有効。該当する投影窓が1つも無ければ無効化する(投影窓が1つもない場合も無効)。
- 複数投影窓を開いていて、一部のシーンだけがそのトリガーに対応している場合でも、ボタンは有効にする(対応していない投影窓では何も起きないだけで、押すこと自体は妨げない)。

### 適用範囲

- 1回のトリガーで、全投影窓(操作UIのプレビュー含む)が同時に反応する。投影窓ごとの個別トリガーは設けない。

### 演出内容と伝搬の仕組み

- `SceneContextBase` に `triggers: [number, number, number]` を新設し、全シーンの `render()` に渡す。各要素はTrigger 1/2/3それぞれの発生状況を表す0-1の値で、発生時1→時間経過で指数関数的に減衰する。`audio.beatPulse` 同様、音声解析結果ではなくUI操作由来の値のため `AudioLevels` には含めない。
- `Scene2D` / `SceneWebGL` に `triggerEffectNames?: (string | undefined)[]`(固定長3、対応する演出があるインデックスにのみ名前を入れる)を追加し、ボタンの有効/無効判定に使う。
- `VJState` に `trigger: { id: string; index: 0 | 1 | 2 } | null` を追加する。`id` はトリガー発生ごとに一意(`crypto.randomUUID()`)とし、既存の `CrossfadeInstruction.id` と同じ考え方で、投影窓側はこの `id` が前回と変わったときだけ新規のトリガーとして減衰を開始する。
- 操作UI側・投影窓側とも、それぞれ自分自身の内部状態(トリガーごとに最後に検知した時刻)から `triggers` の3値を計算する(操作UI側から毎tick進捗を送るわけではない、クロスフェードと同じ設計方針)。

### 各演出の内容

- **Pulse Rings**
  - Ring Burst(Trigger 1) — リング1本を新規生成し、外側へ弾けさせる。
  - Color Flip(Trigger 2) — 発生中、メイン/サブカラーの補間方向を反転させる(既存リングの配色が一瞬入れ替わって見える)。
  - Radius Kick(Trigger 3) — 発生中、全リングの半径に一時的なオフセットを加え、まとめて一瞬拡大させる。
- **Noise Field**
  - Radial Push(Trigger 1) — パーティクルを中心から放射方向に一瞬押し出す。
  - Freeze(Trigger 2) — 発生中、パーティクル位置の計算に使う時間経過を止め、一瞬静止させる。
  - Color Flash(Trigger 3) — 発生中、パーティクル色を白に近づける。

## 非機能要件

- 既存のシーン切替・カラーパレット・シーンプリセット・クロスフェード・複数投影窓・マイク解析機能は引き続き問題なく動作すること。
- マイクが無効の状態でもトリガーは機能する(音声解析に依存しない)。
- 引き続きオフラインで動作すること。

## 受け入れ基準

- [x] パネルに「Trigger 1」「Trigger 2」「Trigger 3」の3ボタンがあり、押すと全投影窓(操作UIのプレビュー含む)が同時に反応する
- [x] `1`/`2`/`3` キーでも同様にトリガーできる。ただし他のフォーム要素(select等)にフォーカスがある間は誤発火しない
- [x] Pulse Ringsが3種類、Noise Fieldが3種類のトリガー演出を持ち、それぞれ意図通りに発生する
- [x] Bar Spectrum・Feedback Loop表示中は、対応するトリガーが無いため押しても何も起きない(エラーにもならない)
- [x] 表示中の投影窓のうち1つでも対応していればボタンは有効、1つも対応していなければ無効化される
- [x] `triggers` の各値は1→0へ滑らかに減衰し、次のトリガーまで演出が残り続けない
- [x] マイク無効時・音声無音時でもトリガーは正常に動作する
- [x] 既存のシーン切替・カラーパレット・シーンプリセット・クロスフェード・複数投影窓機能は引き続き問題なく動作する

## 実装メモ

- 型定義は [src/scenes/_shared/types.ts](../src/scenes/_shared/types.ts) に集約。`SceneContextBase.triggers: [number, number, number]` を全シーンの `render()` に渡し、`Scene2D`/`SceneWebGL` の `triggerEffectNames?: TriggerEffectNames`(固定長3タプル、`string | undefined`)で対応の有無を表現する。
- `VJState.trigger: TriggerInstruction | null`([src/shared.ts](../src/shared.ts))を新設。`TriggerInstruction { id, index }` で、`id` は発火のたびに `crypto.randomUUID()` で発行する。[src/control.ts](../src/control.ts)・[src/display.ts](../src/display.ts) はそれぞれ独立に `triggerFiredAt: [number, number, number]`(各トリガーを最後に検知したtimestamp)と `computeTriggers(now)` を持ち、`id` の変化を検知したら該当インデックスの時刻を更新する(同じ実装をコピーしている。共通化するにはモジュール分割が必要になるが、2箇所×数行のロジックのため見送った)。
- 減衰の時定数は `TRIGGER_PULSE_DECAY_TAU = 0.2`秒(control.ts/display.ts双方で同じ値を定数として持つ)。
- キーボードは `1`/`2`/`3` キー。`e.target` が `HTMLInputElement`/`HTMLSelectElement` のときは無視することで、プリセットselect操作中などの誤発火を防いでいる([src/control.ts](../src/control.ts) の `keydown` ハンドラ)。
- ボタンの有効/無効は `updateTriggerButtonStates()`(control.ts)が毎tick、`displays` 内の全 `currentLayer.scene.triggerEffectNames` を見て判定し直す。
- Pulse Rings([src/scenes/01-pulse-rings.ts](../src/scenes/01-pulse-rings.ts)): Ring Burstは以前のビート同期(撤回済み)と同じ「立ち上がりエッジ検出→リング追加→自身の経過時間で弾けてフェードアウト」。Color Flipは `triggers[1] > 0.5` の間、既存リングのメイン/サブ補間係数 `i/(ringCount-1)` を `1 - i/(ringCount-1)` に反転するだけ(滑らかな補間ではなく閾値で切り替える単純な実装)。Radius Kickは全リングの半径に `triggers[2] * baseR * 0.8` を加算する。
- Noise Field([src/scenes/03-noise-field.ts](../src/scenes/03-noise-field.ts)): Radial Pushは以前のビート同期と同じ「パーティクルを中心からの方向ベクトルに沿って押し出す」処理を `triggers[0]` に対して行う。Freezeは、パーティクル位置計算に使う時間を `triggers[1] > 0.01` の間だけシーンインスタンスのクロージャ内に保持した `frozenAtTime`(発生開始時点の`time`)に固定することで実現した。Color Flashは、`lerpColor()` がhex文字列しか受け付けずrgb()文字列同士の再合成ができないため、`hexToRgb()` で成分を取り出してパレット補間と白へのブレンドを1回のRGB計算にまとめて行っている(実装時に見つけた既存APIの制約)。
- 実機Chrome(開発サーバー、`window.open` を一時的にスタブ化してこの環境の制約を回避)で、Pulse Rings/Noise Fieldそれぞれの3トリガー全ての見た目、Bar Spectrum表示中のボタン無効化、キーボードイベント経由の発火、select要素にフォーカスがある間の誤発火防止を確認済み。
