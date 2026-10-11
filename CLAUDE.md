# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

NoRigVJ: ブラウザ+オフラインで動作するインタラクティブなVJ(Visual Jockey)アプリケーション。マイク入力の音声を解析し、リアルタイムでビジュアルを生成する。特別なオーディオインターフェースやMIDI機材を必要としない点がコンセプト。機能・使い方は [README.md](README.md) を参照。

## コマンド

```bash
npm install       # 依存インストール
npm run dev       # 開発サーバ起動(通常 http://localhost:5173)
npm run build     # tsc -b (型チェック) → vite build
npm run preview   # ビルド成果物のプレビュー
npx tsc --noEmit  # 型チェックのみ実行
npm test          # Vitest(jsdom)で全テストを1回実行
npm run test:watch # ファイル変更を監視してテストを再実行
npx vitest run src/crossfade.test.ts  # 単一ファイルのみ実行
```

## 開発フロー(仕様駆動 + テスト駆動)

ユーザー体験に関わる機能追加・変更や、複数ファイルにまたがる設計判断を伴う変更は、[specs/](specs/README.md) 配下へ仕様書を作成し合意を得てから着手する。タイポ修正など軽微な変更には不要。仕様の合意後は、**実装より先にテストを書く**。

1. **仕様書** — 受け入れ基準の各項目に検証方法を明記する。自動テストで検証するものは `(テスト)`、ブラウザでの目視が必要なもの(シェーダーの見た目など)は `(目視)`。
2. **テストを先に書く(Red)** — `(テスト)` の基準を `*.test.ts` にし、`npm test` で**期待どおりの理由で失敗する**ことを確認する。未実装の関数のimportエラーなど、別の理由で落ちているだけでは確認したことにならない。
3. **最小の実装(Green)** — テストを通すだけの実装を書き、`npm test` / `npx tsc --noEmit` / `npm run build` を通す。`(目視)` の基準はブラウザで確認する。
4. **見直し** — 差分を読み返し、削れるコード・不要になったコードがないか確認する(下記「コードを少なく保つ」)。
5. **ドキュメント更新** — 下記「ドキュメントの更新」。

- テストを通すために期待値を実装へ合わせて書き換えない。期待値が誤っている(=仕様が変わる)なら、先に仕様書を更新する。
- ロジック層のバグ修正は、まず失敗する再現テストを書いてから直す(仕様書は不要)。
- 見た目のみの変更(シェーダー・配色・係数の調整)はテストを書かず、ブラウザで確認する。
- `control.ts` / `display.ts` に載りそうな機能は、テスト可能な純粋関数として切り出す先(モジュール名・シグネチャ)を実装前に決め、そこへテストを書く(例: [src/pad.ts](src/pad.ts))。この2つはimportした時点でDOM・`BroadcastChannel`・`Worker`に副作用を持ち、テストから直接importできないため。

## コードを少なく保つ

実装コードの量を抑える。次回以降にClaudeが読み込む量が減り、実装が単純なほど理解も正確になるため。

- **YAGNI / KISS**: 受け入れ基準を満たす最小のコードだけ書く。仕様にない機能、先回りの汎用化・設定項目・オプション引数・エラー処理は足さない。
- **DRY**(同じ知識を複数の場所に持たない): 書く前に既存コードを検索し、使えるものは再利用する。ただし見た目が似ているだけのコードは共通化しない(3回目で共通化を検討する)。抽象化は、全体のコード量が減るときだけ行う。
- 変更で不要になったコード(旧実装、未使用の関数・型・CSS、後方互換用の残置)は、同じ変更内で削除する。
- 依存・ファイルの追加は、必要性が明確なときだけ。
- **SRP**(1モジュール1責務): ロジックは小さな別モジュールに切り出し、すでに大きい `control.ts` には配線だけを足す。SOLIDのうちSRP以外(OCP/LSP/ISP/DIP)は、抽象層が増えてコード量に反するため採用しない。
- コメントは「なぜ」が非自明なときだけ。
- テストも、受け入れ基準に対応するものだけを書く。実装の内部(関数の呼び出し回数など)を検証するテストは、壊れやすく量も増えるので書かない。
- ドキュメントもDRYの対象。CLAUDE.md群には、コードを読めば分かること(ファイルの逐語的な説明、シーンごとの演出の列挙など)を書かず、設計判断の理由・落とし穴・ファイルパスに絞る。

## テストの書き方

[Vitest](https://vitest.dev/) + jsdom([vitest.config.ts](vitest.config.ts))。対象ファイルと同じ場所に `*.test.ts` を置く(`scenes/` 直下に置いてもシーンとして収集されない)。対象はロジック層(状態同期のタイミング・座標変換・`localStorage`永続化・色計算・シーンのメタデータ不変条件)。シェーダーや描画結果はテストしない(WebGLが必要でピクセル比較は脆いため)。

- `layer.ts` はthree.jsの`WebGLRenderer`に依存するため、それを使うモジュール(`crossfade.ts`)のテストでは `vi.mock("./layer")` でレイヤー操作だけをモックし、タイマーは `vi.useFakeTimers()` で制御する。
- 再現テストの例: [crossfade.test.ts](src/crossfade.test.ts)の「durationMs <= 0」は、`TICK_INTERVAL_MS * 2` の遅延を0へ戻すと落ちる。
- [src/scenes/scenes.test.ts](src/scenes/scenes.test.ts) は新規シーンも自動的に検査する(名前の重複なし・Blank以外はFXパッド対応・パレット非対応はBlankとRainbowのみ)。意図的にこの不変条件を変えるシーンを追加する場合は、このテストも更新する。

## ドキュメントの更新

**実装を変更したら、影響するドキュメントを同じタイミングで必ず更新する。** 具体的には:

- 該当する `specs/*.md` — 受け入れ基準のチェック、実装メモ、ステータス(Draft/Approved/Implemented)
- [README.md](README.md) — セットアップ手順・機能一覧・シーン一覧・操作方法など、ユーザー向けの説明。「何ができるか」の正本はREADME側に置く。
- このファイル、および [src/CLAUDE.md](src/CLAUDE.md) / [src/scenes/CLAUDE.md](src/scenes/CLAUDE.md) — アーキテクチャ・設計判断の理由・既知の注意点など、実装側の詳細

READMEは使い方、CLAUDE.md側は実装理由・落とし穴・ファイルパス。同じ事実を両方へ書き写さず、READMEに書いてあることはCLAUDE.md側ではリンクで済ませる。ドキュメントが実装から乖離すると、後続の開発判断(このファイルを読む次のセッション含む)を誤らせる。「動くようになった」で終わらせず、関連ドキュメントの更新までを実装の一部とする。

## ブランチ運用

ユーザーから依頼された作業(仕様書の有無を問わない)に着手する前に、都度その作業専用のブランチを作成し、そこで実装・コミットする(`main`へ直接コミットしない)。ブランチ名は自由形式(例: `feature/xxx` / `fix/xxx`)。作業が完了しユーザーの確認が取れたら、Claude自身が`main`へマージまで行う(PR作成は不要)。

## CI/CD

GitHub Actions(Node 24、runnerは`ubuntu-26.04`固定。`ubuntu-latest`の移行警告を避けるため)。`main`へのpushは [deploy.yml](.github/workflows/deploy.yml) が `npm ci` → `npm test` → `npm run build` → デプロイを実行し、**テストが落ちるとデプロイされない**。`main`以外へのpushは [ci.yml](.github/workflows/ci.yml) が `npm ci` → `npm test` → `npm run build` を実行する。

## アーキテクチャ概観

- エントリは `control.html`(操作UI)/ `display.html`(投影窓)の2つ([specs/001-multi-window-projection.md](specs/001-multi-window-projection.md)参照)。シーン選択・パレット・プリセットは「予約」してから「クロスフェード実行」で反映する二段階UI([specs/006-scene-crossfade.md](specs/006-scene-crossfade.md)参照)。詳細(状態管理・BroadcastChannel)は [src/CLAUDE.md](src/CLAUDE.md) を参照。
- レンダリングは全シーン **WebGL(three.js)** で統一している([specs/002-webgl-scenes.md](specs/002-webgl-scenes.md)でWebGL対応を導入し、[specs/009-webgl-only-scenes.md](specs/009-webgl-only-scenes.md)で残っていたCanvas 2Dシーンを置き換えて全廃止した)。シーンの実装詳細・追加手順は [src/scenes/CLAUDE.md](src/scenes/CLAUDE.md) を参照。
- **Web Audio API** で音声解析(`getUserMedia` でマイク入力、[src/audio.ts](src/audio.ts))。
- フレームワーク・UIライブラリなし。本番依存は `three` のみ(開発用: `vite` / `typescript` / `vitest` / `jsdom`)。
