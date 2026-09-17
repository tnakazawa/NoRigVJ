# 013: シーケンスモード

- ステータス: Implemented
- 作成日: 2026-09-17

## 背景・目的

[specs/011-semi-auto-mode.md](011-semi-auto-mode.md)・[specs/012-full-auto-mode.md](012-full-auto-mode.md)で追加したRandom/フルオートは、毎回ランダムにシーン・パレットを選ぶ。これとは別に、VJが決めた順序でシーンを自動的に切り替えていく「シーケンスモード」を追加する。フルオートの仕組み(Autoトグル・タイマー駆動)を土台として流用し、自動実行の中身を「ランダム」か「決めた順」かで選べるようにする。

## 要件

### Auto modeの切替

- パネルの「Auto interval」スライダー・Autoトグルの上に、「Auto mode: Random / Sequence」の切替(ラジオボタンまたはセグメントコントロール)を追加する。デフォルトは`Random`(既存動作のまま)。
- Auto mode自体の切替は、フルオートのON/OFF状態やタイマーには影響しない(実行中の設定変更として扱う。手動Crossfade/Randomボタンによる解除ルールとは別物)。
- `Random`選択時の挙動は[specs/012-full-auto-mode.md](012-full-auto-mode.md)のまま変更しない(各投影窓が独立にランダムなシーン・パレットへ、グローバルなAuto interval・Crossfade durationでクロスフェード)。

### シーケンスの作成

- `Sequence`を選んでいる間、パネルに「Edit Sequence...」ボタンを表示する。押すとシーケンス編集用のモーダルを開く。
- モーダル内には以下を配置する。
  - 全シーン(Blank含む)の一覧を表示し、各シーンの「+」ボタンを押すたびに、そのシーンを1ステップとして右側のシーケンス末尾に追加する。**同じシーンを何回追加してもよい**(1つのシーケンスの中で同じシーンを違うパレット・タイミングで繰り返し使いたいケースに対応するため)。
  - 追加されたステップは右側にリスト化され、ドラッグハンドルを掴んでドラッグ&ドロップで並べ替えられる。この並び順がそのまま実行順になる。各ステップに「✕」ボタンを持たせ、削除できるようにする。ドラッグ操作は専用のハンドル要素からのみ開始できるようにし、Duration/Crossfadeスライダーの操作(クリック・ドラッグ)が誤って行のドラッグとして扱われないようにする。
  - 各ステップに、カラーパレット選択(32色プリセット、またはmain/subのカスタムカラー)を個別に持たせる。パレット非対応のシーン(Blank・Rainbow)ではパレットUIを無効化する(既存の投影窓行と同じ扱い)。
  - **各ステップに、そのステップ専用の「Duration」(表示し続ける時間、5〜60秒)と「Crossfade」(そのステップへ切り替わる際の時間)を個別に持たせる**。Crossfadeの上限はそのステップのDurationとし、Durationを縮めた際にCrossfadeがそれを超えていれば自動的に短縮する(クロスフェードが終わる前に次のステップへ進んでしまう状態を避けるため)。
- モーダルでの変更(編集中の内容)は`localStorage`に永続化し、ページ再読み込み後も維持する(既存の[presets.ts](../src/presets.ts)と同様の方式)。
- シーケンスが0件(何も追加していない)の間は、`Sequence`モードでAutoをONにできない(トグルを無効化する)。
- **編集中の内容とは別に、複数のシーケンスを名前付きで保存・呼び出し・削除できる**(既存の投影窓プリセット([presets.ts](../src/presets.ts))と同じ考え方)。モーダルに「Save Sequence」ボタン・プリセット選択・「Delete」ボタンを持たせる。「Save Sequence」は現在のステップ一式(並び順・パレット・Duration・Crossfade時間を含む)を丸ごと名前付きで保存する。プリセットを選ぶと、編集中の内容がそのプリセットの内容で置き換わる(保存も自動では行わないため、モーダルを閉じて確定させる)。

### シーケンスの自動実行

- フルオートがON かつ Auto mode=`Sequence`の場合、**現在のステップに設定されたDuration(表示時間)が経過するたびに**、シーケンスの次のステップへ進む。末尾まで進んだら先頭に戻ってループする。**Sequenceモード中はグローバルな「Auto interval」スライダーを使わない**(各ステップが自分のタイミングを持つため。UI上もAuto intervalスライダー自体を隠し、Randomモード専用にする)。
- **フルオートをONにした瞬間、待たずにすぐ最初のステップへ切り替える**(Randomモードで即座にランダム化されるのと同様、Sequenceモードでも「ONにしたら何も起きないまま最初のDurationが経過するのを待つ」ことはしない)。以降は通常通り、切り替わった各ステップのDurationが経過するたびに次へ進む。
- **全投影窓が同じ「現在のシーケンス位置」を共有し、同時に同じシーン・同じパレットへ切り替わる**(投影窓ごとに独立ではない — Random時とはここが異なる。決めた通りの演出を全投影窓で揃って見せることが目的のため)。
- 切替は、進む先のステップに設定された専用のCrossfade時間でクロスフェードする(グローバルなCrossfade durationは使わない)。
- **いずれかの投影窓がまだ前のクロスフェードを実行中の間は、次のステップへ進めない**(進めてしまうと、その投影窓はそのステップを一度も表示しないまま次に飛ばされてしまう)。その場合はシーケンス位置を進めず、少し待ってから再試行する。
- 手動でのCrossfade/Randomボタン操作によるフルオート解除ルール([specs/012-full-auto-mode.md](012-full-auto-mode.md)参照)は、Auto mode=`Sequence`のときも同様に適用する。

## 非機能要件

- シーケンスの永続化データ(各ステップのid・シーン名・パレット・Duration・Crossfade時間・並び順)は`localStorage`に保存する。

## 受け入れ基準

- [x] パネルに「Auto mode: Random / Sequence」の切替が表示され、デフォルトは`Random`
- [x] `Sequence`を選ぶと「Edit Sequence...」ボタンが表示され、「Auto interval」スライダーが隠れる
- [x] モーダルで「+」を押してシーンをシーケンスへ追加でき、同じシーンを複数回追加できる
- [x] 追加したステップをドラッグハンドルからドラッグ&ドロップで並べ替え、「✕」で削除でき、各ステップにパレット・Duration・Crossfade時間を個別に指定できる
- [x] Duration・Crossfadeスライダーの操作中に、行が誤ってドラッグ状態にならない
- [x] 各ステップのCrossfade時間は、そのステップのDurationを超えないようクランプされる
- [x] モーダルでの編集中の内容は`localStorage`に保存され、ページ再読み込み後も維持される
- [x] 「Save Sequence」で編集中の内容を名前付きで保存し、選択して呼び出すと編集中の内容がその内容に置き換わり、「Delete」で削除できる
- [x] シーケンスが0件の間、`Sequence`モードでAutoトグルは無効化される
- [x] Auto mode=`Sequence`でAutoをONにすると、即座に最初のステップへ切り替わり、以降は各ステップのDurationが経過するたびに全投影窓が同時に同じシーン・パレットへ、そのステップのCrossfade時間でクロスフェードする
- [x] Crossfade時間がDurationいっぱいの設定でも、ステップが一つも飛ばされずに順番通り進む
- [x] シーケンスの末尾まで進んだら先頭に戻ってループする
- [x] Auto mode=`Random`に戻すと、既存のRandom/フルオートの挙動(各投影窓独立ランダム、グローバルCrossfade duration・Auto interval使用)に戻る
- [x] 手動でのCrossfade/Randomボタン操作は、`Sequence`モードでも同様にフルオートを解除する

## 実装メモ

- [src/sequence.ts](../src/sequence.ts) — `SequenceStep`(`id`・シーン名・パレット・`intervalMs`(表示時間)・`crossfadeDurationMs`)配列をまとめた`SequenceData`の型と`localStorage`読み書き([presets.ts](../src/presets.ts)と同じ方針でシーン名識別だが、同じシーン名が複数ステップに存在しうるため、一意な`id`で個々のステップを識別する)。
- [src/control.ts](../src/control.ts) — `autoMode`("random"|"sequence")・`sequenceSteps`・`sequenceIndex`(現在の再生位置、-1は「未再生」)をモジュールスコープの状態として持つ。`advanceSequence()`が`sequenceIndex`をインクリメントし、全`displays`に同じステップ(シーン・パレット・そのステップのCrossfade時間)を適用する(Randomの`randomizeEntry()`とは異なり、投影窓ごとの個別ランダム抽選をしない)。`peekNextSequenceStep()`で「次に表示される予定のステップ」を覗き見て、そのステップの`intervalMs`を次回発火までの待ち時間として使う(`tick()`内の発火判定、およびAutoトグルをONにする瞬間の両方から呼ぶ)。
- Sequenceモードはグローバルな`fullAutoIntervalMs`(Auto interval)を使わないため、`autoIntervalSection`(セクション要素)を`updateAutoModeUI()`内で`autoMode === "sequence"`のとき隠す。
- シーケンス専用のクロスフェード時間を投影窓(display.ts)側にも正しく伝えるため、`DisplayEntry`に`crossfadingDurationMs: number | null`を追加し、`startEntryCrossfade(entry, durationMs = crossfadeDurationMs)`で実際に使った値を記録、`tick()`が`VJState.crossfadeByWindow`へ送る`durationMs`は`entry.crossfadingDurationMs ?? crossfadeDurationMs`を見るように変更した(既存はグローバルな`crossfadeDurationMs`を常に送っていたため、ステップ専用の値がここで無視されてしまうバグになるところだった)。
- モーダルのシーケンス編集UIはドラッグ&ドロップ(HTML5 Drag and Drop API、追加ライブラリなし)で並べ替える。各行の並び順はDOM順そのものを正とし、`dragend`時に`syncSequenceStepsFromDom()`でDOM順から`sequenceSteps`配列を再構築する(`data-step-id`属性で行を識別するため、同じシーン名の重複があっても正しく並べ替わる)。パレット選択は投影窓行と同じ`createPaletteDropdown()`を再利用している。各ステップ行のDurationスライダーは、変更のたびにCrossfadeスライダーの`max`属性を追従させ、超えていれば値も短縮する。
- **実装中に見つけたCSSバグ**: `.modal-overlay { display: flex; }`という作者(author)側のルールが、`[hidden] { display: none; }`というブラウザ既定(User Agentスタイルシート)のルールより優先されてしまい、`hidden`を付けてもモーダルが表示されたままになっていた(原因はセレクタの詳細度ではなくCSSカスケードのorigin優先順位。詳細は下記「追加修正」の項、および[src/CLAUDE.md](../src/CLAUDE.md)の既知の注意点を参照)。`.modal-overlay[hidden] { display: none; }`を追加して解決。
- 動作確認: ブラウザで(1)同じシーンを2回追加→削除、(2)Durationを縮めるとCrossfadeが追従してクランプされること、(3)`localStorage`保存(旧形式データからの`id`補完も含む)、(4)Duration=5秒に統一した3ステップでの自動進行が正しい順序でループすること、(5)複数投影窓が同じシーンを共有すること、(6)Sequence選択中はAuto intervalスライダーが隠れること、をそれぞれ確認した。

### 追加修正(ドラッグ干渉バグ・シーケンスの保存/呼び出し/削除)

- **バグ**: 各ステップ行に`draggable="true"`を常時付けていたため、行内のDuration/Crossfadeスライダーを操作しようとした瞬間に、ブラウザが「行自体のドラッグ開始」と誤認識してしまい、スライダーが操作できなかった。**修正**: 行は常時`draggable = false`にしておき、ドラッグハンドル要素(⋮⋮)の`mousedown`で`row.draggable = true`、`mouseup`/`dragend`で`false`に戻す方式に変更した(詳細は[src/CLAUDE.md](../src/CLAUDE.md)の既知の注意点に追記)。
- **シーケンスの保存・呼び出し・削除**: [src/sequence.ts](../src/sequence.ts)に`SequencePreset`(`id`・`name`・`steps`)型と、専用の`localStorage`キー(`norigvj-sequence-presets`)への読み書き(`loadSequencePresets` / `saveSequencePreset` / `deleteSequencePreset`)を追加。編集中のシーケンス(`loadSequence`/`saveSequence`、1本のみ)とは完全に別のデータとして扱う。旧形式データ(`id`なし等)からの補完ロジックは`normalizeSteps()`に共通化し、編集中データ・プリセットどちらの読み込みでも使う。
- モーダルに「Save Sequence」ボタン・プリセット選択(`sequence-preset-select`)・「Delete」ボタンを追加(既存の投影窓プリセット行(`.preset-row`)と同じCSSクラスを再利用)。「Save Sequence」は`prompt()`で名前を聞き(デフォルト名は`Sequence (N steps)`)、ドラッグ直後の状態を確実に反映するため`syncSequenceStepsFromDom()`を呼んでから保存する。呼び出しは選択したプリセットの`steps`をディープコピーして`sequenceSteps`に代入し、リストを再描画するのみ(自動では保存しないため、確定させるにはモーダルを閉じる必要がある)。
- 動作確認: ブラウザで(1)Durationスライダーのドラッグ操作でハンドル以外からは行がドラッグされないこと、(2)ハンドルからは正常にドラッグできること、(3)保存→全削除→呼び出しで内容が復元されること、(4)削除で選択肢から消えること、をそれぞれ確認した。

### 追加修正(ステップの飛ばされ・即時開始・selectの見た目統一)

- **バグ**: あるステップのCrossfade時間がDurationに近い(特に一致する)設定の場合、そのステップへのクロスフェードがまだ完了していないタイミングで次の発火が来ることがあり、`advanceSequence()`内の`if (entry.crossfadingInstructionId) return;`によってその投影窓だけがステップをスキップされてしまっていた。しかし`sequenceIndex`自体は関数の先頭で無条件にインクリメントしていたため、そのステップは(その投影窓では)一度も表示されないまま失われていた。**修正**: `advanceSequence()`の先頭で「いずれかの投影窓がまだクロスフェード中」なら`sequenceIndex`を進めずに`false`を返すようにし(全投影窓の準備が整うまで`sequenceIndex`はインクリメントされない)、呼び出し側(`tick()`・Autoトグルのクリックハンドラ)は`false`が返ったら100ms後に再試行するようにした。これにより、進行がわずかに遅れることはあっても、ステップが失われることはなくなる。
- **Auto ON時にすぐ開始する**: `autoToggleBtn`のクリックハンドラで、`Sequence`モードをONにする瞬間に`advanceSequence()`を呼んで即座に最初のステップへ切り替えるようにした(以前はONにしても、最初のステップのDurationが経過するまで何も起きなかった)。`tick()`側の発火ロジックは変更していない(こちらは元々「発火したら進める」設計だったため)。
- **シーケンス専用selectの見た目**: `sequence-preset-select`(および将来追加されうる他のselect)が、投影窓行のselect用だった`.display-row-controls select`セレクタのスコープ外だったため、ブラウザ既定の見た目のままになっていた。セレクタを汎用的な`select` / `select:disabled`に変更し、モーダル内外を問わず統一されたダークテーマの見た目になるようにした。
- **CSSバグの再発**: 上記の修正時、Sequenceモード選択中に隠すはずの`#auto-interval-section`(`hidden`属性)が表示されたままになっていることに気づいた。原因は[013実装メモの.modal-overlayの件](#実装メモ)と同根で、`section { display: flex; }`という汎用ルール(author stylesheet)が`[hidden] { display: none }`(UA stylesheet)より優先されてしまうこと(詳細度ではなくcascade originの優先順位の問題。同じ詳細度の競合ではなく、authorスタイルは常にUAスタイルより優先されるため、要素セレクタでも起きる)。`#auto-interval-section[hidden] { display: none; }`を追加して解決し、[src/CLAUDE.md](../src/CLAUDE.md)の既知の注意点をこの一般的な原因の説明に更新した。
- 動作確認: ブラウザで(1)Duration=Crossfade=5秒という最も厳しい設定の3ステップシーケンスを作り、10秒以上にわたり選択中のシーンを100ms間隔でポーリングして記録し、順序(ステップ1→2→3→1→2→3→…)が一度も欠落しないことを確認、(2)Auto ONにした瞬間に最初のステップへ切り替わることを確認、(3)Sequence選択中に「Auto interval」セクションが実際に非表示(`display: none`)になることを確認、(4)モーダル内のselectがパレットドロップダウンと同じ見た目になっていることを確認した。
