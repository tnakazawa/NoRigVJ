# VJ App

ブラウザで動作するインタラクティブなVJ(Visual Jockey)アプリケーション。
マイク入力の音声を解析し、リアルタイムでビジュアルを生成します。

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで表示されたURL(通常 http://localhost:5173)を開いてください。

## 操作方法

| キー | 動作 |
|---|---|
| Space | マイク入力を有効化 |
| 1〜3 | ビジュアルシーンを切り替え |
| ← / → | エフェクトの強度を調整 |

## ビルド

```bash
npm run build
npm run preview
```

## 今後の拡張案

- MIDIコントローラー対応(Web MIDI API)
- WebGL/シェーダーベースのシーン追加
- シーン間のクロスフェード
- BPM検出によるビート同期
