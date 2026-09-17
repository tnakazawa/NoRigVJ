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
```

テストは未整備。単体テストコマンドなし。

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
