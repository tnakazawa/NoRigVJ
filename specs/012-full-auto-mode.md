# 012: フルオートモード

- ステータス: Implemented
- 作成日: 2026-09-16

## 背景・目的

[specs/011-semi-auto-mode.md](011-semi-auto-mode.md)で追加した「Random」ボタン(セミオートモード)は、VJが押すたびに1回だけランダム化する。これをさらに、ボタン操作なしで設定した間隔ごとに自動で実行し続けるモードを追加する。VJがその場を離れても、あるいは操作に集中していても、一定間隔でビジュアルが自動的に変わり続けるようにする。

## 要件

- パネルに「Auto interval」スライダーを追加する(5秒〜60秒、1秒刻み)。値は秒単位でラベル表示する。
- パネルに、フルオートのON/OFFを切り替えるトグルボタンを追加する。ボタンには「現在の状態」ではなく「押すと切り替わる先」を表示する。
  - OFF時の表示: `Auto: ON`(押すとONにできることを示す)
  - ON時の表示: `Auto: OFF (next in mm:ss)`(押すとOFFにできることを示す。あわせて次回自動実行までの残り時間を `mm:ss` 形式でリアルタイム表示する)
  - このトグルボタンは、投影窓(Display)の有無にかかわらず常に押せる(投影窓が0個でもON/OFFを切り替えられる。Randomボタンとは異なり無効化しない — ONのまま投影窓が0個になり、ボタン自体がdisabledでOFFに戻せなくなる事故を避けるため)。
- Crossfade durationがAuto intervalを超えないようにする(クロスフェードが終わる前に次の自動切替が来てしまう状態を避けるため)。同期は片方向で、次のいずれのタイミングでもCrossfade durationがAuto intervalを超えていれば、Auto intervalと同じ値まで自動的に短縮する(Crossfade duration側を先にAuto intervalより長くしても、その時点では制限しない — 下記のいずれかのタイミングで初めて短縮される)。
  - Auto intervalスライダーを操作したとき
  - フルオートをONにした瞬間(トグルボタンを押してONにするとき)
  - フルオートがONの間にCrossfade durationスライダーを操作したとき
- フルオートがONの間、設定した間隔が経過するたびに、[specs/011-semi-auto-mode.md](011-semi-auto-mode.md)の「Random」ボタンと全く同じ処理(各投影窓を独立にランダムなシーン・パレットへクロスフェード、Intensityもランダム変更)を自動実行する。投影窓が0個のときは何も対象がないため実質何も起きない(Intensityのみランダム変更される)。
- 次のいずれかの手動操作が行われた場合、フルオートは即座にOFFになり、タイマーは破棄される(トグルボタンの表示も `Auto: OFF (next in mm:ss)` → `Auto: ON` に戻る)。
  - いずれかの投影窓の「Crossfade」ボタンをVJが手動でクリックする
  - 「Random」ボタンをVJが手動でクリックする
- 以下の操作ではフルオートを解除しない(実際のシーン切替=クロスフェード実行ではなく、次に切り替える内容の「予約」や、シーン自体には無関係な演出のため):
  - シーン選択・パレット選択・カラーピッカー・シーンプリセット呼び出し(いずれも予約(pendingLayer)を変更するだけで、まだ画面には反映されない)
  - Trigger 1/2/3の発火
  - Intensity・Crossfade durationスライダーの操作
- フルオート自身が実行する自動クロスフェード・自動Intensity変更は、上記の「手動操作によるOFF化」の対象にならない(自分自身を毎回OFFにしてしまわないようにする)。

## 非機能要件

- 特になし。既存のセミオートモードのロジックをそのまま再利用する。

## 受け入れ基準

- [x] パネルに「Auto interval」スライダー(5〜60秒)が表示され、値がラベルに反映される
- [x] パネルにフルオートのトグルボタンが表示され、投影窓が0個でも操作できる
- [x] トグルをONにすると、設定間隔が経過するたびに全投影窓が独立にランダムなシーン・パレットへクロスフェードし、Intensityも変わる
- [x] OFF時はボタンに `Auto: ON`、ON時はボタンに `Auto: OFF (next in mm:ss)` と次回実行までの残り時間が表示される
- [x] Auto intervalをCrossfade durationより短い値に設定すると、Crossfade durationが自動的にAuto intervalと同じ値まで短縮される
- [x] Crossfade durationがAuto intervalより長い状態でフルオートをONにすると、Crossfade durationが自動的にAuto intervalと同じ値まで短縮される
- [x] フルオートON中にCrossfade durationをAuto intervalより長い値に操作しても、Auto intervalと同じ値までクランプされる
- [x] フルオートON中に投影窓の「Crossfade」ボタンを手動で押すと、フルオートがOFFになる
- [x] フルオートON中に「Random」ボタンを手動で押すと、フルオートがOFFになる
- [x] フルオートON中にシーン予約変更・パレット変更・プリセット呼び出し・Trigger発火・Intensity/Crossfade durationスライダー操作を行っても、フルオートはONのまま維持される

## 実装メモ

`src/control.ts` に `fullAutoEnabled`/`fullAutoIntervalMs`/`fullAutoNextFireAt` の3状態を追加。`tick()`(33ms間隔)内で `fullAutoEnabled && now >= fullAutoNextFireAt` を判定し、達していれば[specs/011-semi-auto-mode.md](011-semi-auto-mode.md)の `randomizeAll()` をそのまま呼んで次回時刻を再設定する。トグルボタンのラベル更新(`mm:ss`カウントダウン)も同じ`tick()`内で毎回行う。手動操作による解除(`disableFullAuto()`)は、各投影窓の`crossfadeBtn`クリックハンドラと、パネルの`randomBtn`クリックハンドラの先頭で呼んでいる(シーン予約変更・Trigger・Intensity/Crossfade durationのハンドラは変更していないため、そこでは解除されない)。フルオート自身が呼ぶ`randomizeAll()`は`disableFullAuto()`を経由しないため、自分自身をOFFにする心配はない。

トグルボタンは「現在の状態」ではなく「押すと切り替わる先」を表示する設計にした(OFF中は`Auto: ON`、ON中は`Auto: OFF (next in mm:ss)`)。Crossfade durationのクランプは`clampCrossfadeDurationToAutoInterval()`に共通化し、`crossfadeDurationMs > fullAutoIntervalMs` の場合のみ`setCrossfadeDuration()`とスライダーのDOM値を書き換える。この関数を3箇所から呼ぶ: `setAutoInterval()`(Auto interval変更時)、`autoToggleBtn`のクリックハンドラのON化直後(フルオートを起動する瞬間)、`crossfadeDurationSlider`の`input`ハンドラ内で`fullAutoEnabled`のときだけ(フルオートON中にCrossfade durationを動かした直後)。

動作確認: (1) Crossfade duration=16秒の状態でAuto interval=5秒にすると16→5秒に短縮、(2) Crossfade duration=16秒の状態でAuto ONを押すと15秒(その時のAuto interval)に短縮、(3) フルオートON中にCrossfade durationを16秒にしようとしても15秒までしか上がらない、の3パターンをブラウザで確認した。
