# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

NoRigVJ: ブラウザ+オフラインで動作するインタラクティブなVJ(Visual Jockey)アプリケーション。マイク入力の音声を解析し、リアルタイムでCanvas 2Dにビジュアルを生成する。特別なオーディオインターフェースやMIDI機材を必要としない点がコンセプト。

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

## アーキテクチャ

- **Canvas 2D API** でレンダリング(WebGL未使用)。
- **Web Audio API** で音声解析(`getUserMedia` でマイク入力)。
- フレームワーク・UIライブラリなし。依存は `vite` と `typescript` のみ。

### 主要ファイル

- [src/main.ts](src/main.ts) — エントリポイント。canvasのリサイズ、キー入力ハンドリング、`requestAnimationFrame` によるメインループを持つ。マイク未有効時はサイン波のダミー値で `AudioLevels` を代替し、許可なしでも見た目を確認できるようにしている。
- [src/audio.ts](src/audio.ts) — `AudioAnalyzer` クラス。`fftSize: 512`、`smoothingTimeConstant: 0.8` で周波数データを取得し、周波数ビンを低域0〜10%/中域10〜50%/高域50〜100%に分割して `volume/bass/mid/treble`(各0-1)を算出する。
- [src/scenes.ts](src/scenes.ts) — `Scene { name, render(SceneContext) }` インターフェースで統一されたビジュアルシーン群。`scenes` 配列に追加するだけで `main.ts` 側の切り替え対象に自動的に組み込まれる。実装済み: Pulse Rings / Bar Spectrum / Noise Field。

### シーン追加の手順

1. `src/scenes.ts` に `Scene` を実装した定数を追加。
2. `render(SceneContext)` 内で `audio.volume/bass/mid/treble`(0-1)と `time`(秒)を使って描画。
3. 末尾の `scenes` 配列に追加すれば、キー入力(数字キー)とHUD表示に自動反映される。

### 既知の注意点

`analyser.getByteFrequencyData()` に `Uint8Array` を渡すとTS5.5で `Uint8Array<ArrayBufferLike>` の型エラーが出るため、`src/audio.ts` 内で `as Uint8Array<ArrayBuffer>` にキャストしている。

### 操作方法

| キー | 動作 |
|---|---|
| Space | マイク入力を有効化 |
| 1〜3 | ビジュアルシーンを切り替え |
| ← / → | エフェクトの強度を調整(0〜3) |

左下のHUD(`#hud`)に現在のシーン・マイク状態・強度を表示する。
