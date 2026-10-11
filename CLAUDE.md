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

## テスト方針

テストは [Vitest](https://vitest.dev/) + jsdom([vitest.config.ts](vitest.config.ts))。`src/` 配下に対象ファイルと同じ場所へ `*.test.ts` として置く。**ロジック層(状態同期のタイミング・座標変換・localStorage永続化・色計算・シーンのメタデータ不変条件)を対象とし、シェーダーや描画結果の見た目はテストしない**(WebGLが必要でピクセル比較は脆いため。見た目はブラウザでの目視確認で担保する)。

- CI/CD(GitHub Actions、Node 20): `main` へのpushは [.github/workflows/deploy.yml](.github/workflows/deploy.yml) が `npm ci` → `npm test` → `npm run build` → デプロイの順に実行し、**テストが落ちるとデプロイされない**。`main` 以外のブランチへのpushは [.github/workflows/ci.yml](.github/workflows/ci.yml) が `npm ci` → `npm test` → `npm run build`(`tsc -b` による型チェック含む)を実行する(mainはdeploy.ymlが担うため対象外で、二重実行しない)。
- `control.ts` / `display.ts` はimportした時点でDOM・`BroadcastChannel`・`Worker`に副作用を持つためテストから直接importできない。テストしたいロジックは `pad.ts` のように副作用のない別モジュールへ切り出してから、そちらをテストする。
- `layer.ts` はthree.jsの`WebGLRenderer`に依存するため、それを使うモジュール(`crossfade.ts`)のテストでは `vi.mock("./layer")` でレイヤー操作だけをモックする。タイマーは `vi.useFakeTimers()` で制御する。
- ロジック層のバグを直したときは、再発を検知できる回帰テストの追加を検討する(例: [crossfade.test.ts](src/crossfade.test.ts)の「durationMs <= 0」。`TICK_INTERVAL_MS * 2` の遅延を0へ戻すと落ちる)。
- [src/scenes/scenes.test.ts](src/scenes/scenes.test.ts) は新規シーンも自動的に検査する(名前の重複なし・Blank以外はFXパッド対応・パレット非対応はBlankとRainbowのみ)。意図的にこの不変条件を変えるシーンを追加する場合は、このテストも更新する。

## 開発フロー(仕様駆動開発)

ユーザー体験に関わる機能追加・変更や、複数ファイルにまたがる設計判断を伴う変更は、実装前に [specs/](specs/README.md) 配下へ仕様書を作成し合意を得てから着手する。詳細は [specs/README.md](specs/README.md) を参照。タイポ修正など軽微な変更には不要。

**実装を変更したら、影響するドキュメントを同じタイミングで必ず更新する。** 具体的には:

- 該当する `specs/*.md` — 受け入れ基準のチェック、実装メモ、ステータス(Draft/Approved/Implemented)
- [README.md](README.md) — セットアップ手順・機能一覧・シーン一覧・操作方法など、ユーザー向けの説明が実装とズレていないか。「何ができるか」の正本はREADME側に置く。
- このファイル、および [src/CLAUDE.md](src/CLAUDE.md) / [src/scenes/CLAUDE.md](src/scenes/CLAUDE.md) — アーキテクチャ・設計判断の理由・既知の注意点など、実装側の詳細

READMEとCLAUDE.md群で「操作方法」のような事実が重複することはあるが、役割が違うので両方に書いてよい。READMEは使い方、CLAUDE.md側はその実装理由・ファイルパスまで踏み込む。ドキュメントが実装から乖離すると、後続の開発判断(このファイルを読む次のセッション含む)を誤らせる。「動くようになった」で終わらせず、関連ドキュメントの更新までを実装の一部とする。

### ブランチ運用

ユーザーから依頼された作業(仕様書の有無を問わない)に着手する前に、都度その作業専用のブランチを作成し、そこで実装・コミットする(`main`へ直接コミットしない)。ブランチ名は自由形式(例: `feature/xxx` / `fix/xxx`)。作業が完了しユーザーの確認が取れたら、Claude自身が`main`へマージまで行う(PR作成は不要)。

## アーキテクチャ概観

- エントリは `control.html`(操作UI)/ `display.html`(投影窓)の2つ([specs/001-multi-window-projection.md](specs/001-multi-window-projection.md)参照)。シーン選択・パレット・プリセットは「予約」してから「クロスフェード実行」で反映する二段階UI([specs/006-scene-crossfade.md](specs/006-scene-crossfade.md)参照)。詳細(状態管理・BroadcastChannel・操作方法)は [src/CLAUDE.md](src/CLAUDE.md) を参照。
- レンダリングは全シーン **WebGL(three.js)** で統一している([specs/002-webgl-scenes.md](specs/002-webgl-scenes.md)でWebGL対応を導入し、[specs/009-webgl-only-scenes.md](specs/009-webgl-only-scenes.md)で残っていたCanvas 2Dシーンを置き換えて全廃止した)。シーンの実装詳細・追加手順は [src/scenes/CLAUDE.md](src/scenes/CLAUDE.md) を参照。
- **Web Audio API** で音声解析(`getUserMedia` でマイク入力、[src/audio.ts](src/audio.ts))。
- フレームワーク・UIライブラリなし。依存は `vite` / `typescript` / `three` のみ。
