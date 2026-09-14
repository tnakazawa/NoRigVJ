# 002: WebGLシーン対応とシーンアーキテクチャ刷新

- ステータス: Implemented
- 作成日: 2026-09-13

## 背景・目的

現状のシーンはCanvas 2D専用で、`src/scenes.ts` 1ファイルに全シーンをベタ書きし、末尾の配列に手動登録している。今後、表現力の高いWebGLシーン(フィードバックループ、大量パーティクル、シェーダーアート等)を追加していきたい。また、将来的に他の開発者がシーンをファイル単位で自由に追加・削除できるようにしたいため、この機会にシーンのファイル構成とインターフェースを刷新する。

なお、「シーンをコードを書かずに追加できるプラグイン機構」は今回のスコープ外。あくまで開発者がリポジトリにファイルを追加する形の拡張性を指す。

## 要件

### 依存関係

- WebGL描画には **three.js** を採用する。`package.json` の依存に追加する。
- Canvas 2D側は既存のまま(素のCanvas 2D API)。

### シーンのファイル構成

- シーンを `src/scenes/` ディレクトリ配下に1シーン1ファイルで配置する(例: `src/scenes/01-pulse-rings.ts`)。
- ファイル名の連番プレフィックス(`01-`, `02-`, ...)でシーンの並び順・キー割当(1, 2, 3...)を決める。
- 既存の3シーン(Pulse Rings / Bar Spectrum / Noise Field)も、このタイミングで `src/scenes.ts` から `src/scenes/` 配下の個別ファイルに分割する(見た目・動作は変更しない)。
- Viteの `import.meta.glob` を使い、`src/scenes/` 配下のファイルをビルド時に自動収集して `scenes` 配列を生成する。新しいシーンファイルを追加するだけで、GUIのシーン選択・キー入力(数字キー)・投影窓の描画対象に自動的に反映される(手動でのimport/配列登録は不要)。

### Scene interfaceの拡張

- 2D/WebGL共通の `Scene` 型を用意し、`kind: "2d" | "webgl"` で描画方式を区別する。
- 状態(WebGLのRenderTargetなど)を安全に持てるよう、シーンファイルは **シーンオブジェクトそのものではなく、シーンを生成するファクトリ関数** を `default export` する。操作UI(プレビュー)と投影窓は別々のcanvas/WebGLコンテキストを持つため、それぞれが独立したシーンインスタンスをファクトリから生成する。
- 型のイメージ:

  ```ts
  interface SceneContextBase {
    width: number;
    height: number;
    time: number; // 秒
    audio: AudioLevels;
  }

  interface SceneContext2D extends SceneContextBase {
    ctx: CanvasRenderingContext2D;
  }

  interface SceneContextWebGL extends SceneContextBase {
    renderer: THREE.WebGLRenderer;
  }

  interface Scene2D {
    kind: "2d";
    name: string;
    render(ctx: SceneContext2D): void;
  }

  interface SceneWebGL {
    kind: "webgl";
    name: string;
    init?(ctx: SceneContextWebGL): void; // シェーダーコンパイル・RenderTarget確保など、初回のみ呼ばれる
    render(ctx: SceneContextWebGL): void;
  }

  type Scene = Scene2D | SceneWebGL;
  type SceneFactory = () => Scene;
  ```

### canvas構成

- `control.html` / `display.html` それぞれに、既存の2D用canvasと重ねてWebGL用canvasを配置する。
- アクティブなシーンの `kind` に応じて、2D用/WebGL用のどちらかのcanvasを表示し、もう一方を非表示にする。

### 最初のWebGLシーン

- 表現: **フィードバックループ**。前フレームの描画結果を次フレームの入力として使い、歪み・回転などを加えながら重ねることで残像・渦のような表現を作る。
- three.jsの `WebGLRenderTarget` を2枚ピンポンして実装する。
- 既存シーンと同様、`audio`(volume/bass/mid/treble)と `time` を使って歪み・回転量などを変化させる。

## 非機能要件

- 既存の2Dシーン(Pulse Rings / Bar Spectrum / Noise Field)は、ファイル分割後も見た目・挙動を変更しない。
- 既存のマルチウィンドウ機能([specs/001-multi-window-projection.md](001-multi-window-projection.md): BroadcastChannel同期、フルスクリーン、接続状態表示)はWebGLシーンでも同様に動作すること。
- 依然としてオフラインで動作すること(three.jsはビルドに含めてバンドルし、外部CDN等には依存しない)。

## 受け入れ基準

- [x] `src/scenes/` 配下の各ファイルが1シーンに対応し、`scenes` 配列がビルド時の自動収集で生成される(手動登録不要)
- [x] 新しいシーンファイルを追加すると、GUIのシーン選択ボタン・数字キー操作・投影窓の描画に自動的に反映される
- [x] 既存3シーンが分割後も見た目・動作が変わらず動作する
- [x] 新規WebGLシーン「フィードバックループ」がシーン一覧に加わり、選択して描画できる
- [x] フィードバックループシーンは操作UIのプレビューと投影窓それぞれで、独立した状態(前フレームのRenderTarget)を保ちながら正しく描画される
- [x] シーン切替・強度調整・マイク反応・投影窓との同期・フルスクリーンなど、既存のマルチウィンドウ機能がWebGLシーンでも問題なく動作する

## 実装メモ

- シーンモジュールは `SceneFactory`(`() => Scene`)を `default export` する形式に統一。`src/scenes/index.ts` が `import.meta.glob("./*.ts", { eager: true })` で自身(`index.ts`)を除く全ファイルを収集し、パス文字列でソートしてファクトリ配列を作る。`import.meta.glob` の型解決には `tsconfig.json` の `compilerOptions.types` に `"vite/client"` を追加する必要があった。
- ヘルパー(型定義・色ユーティリティ)は `src/scenes/_shared/` に置き、シーンとして誤収集されないようにした。
- 操作UI(`control.ts`)・投影窓(`display.ts`)は、それぞれ独自の `THREE.WebGLRenderer` を持ち、`sceneFactories.map(f => f())` で自分専用のシーンインスタンス配列を生成する。WebGLシーンの `init()` はページロード時に全WebGLシーンへ一括で呼んでいる(シーン数が少ないため、切替時の遅延初期化はせず先出しでコンパイルしている)。**[specs/006-scene-crossfade.md](006-scene-crossfade.md)でこの方式は変更された**: クロスフェード対応のため、「投影窓ごとに全シーンを事前生成して使い回す」設計から「シーン切替のたびに新しいレイヤー(canvas+renderer+シーンインスタンス)を生成する」設計に変わっている。
- **ハマった点**: 2D用/WebGL用canvasを重ねて `display: none` で切り替える構成にしたところ、シーン切替直後にWebGL描画が真っ黒になった。`display: none` の要素は `clientWidth`/`clientHeight` が0になり、`renderer.setSize()` に0が渡っていたのが原因。`setSceneIndex()` 内で表示切替の直後に `resize()` を呼び直すことで解消した。
- **ハマった点**: フィードバックループの最初の実装では、前フレーム減衰(0.94)とシード強度(最大1.0)のバランスが悪く、数秒で中心が白飛びした。定常状態の収束値は `seed / (1 - decay)` になるため、`decay=0.9` にしつつシード強度を `0.01 + volume*0.05`(最大0.06)程度まで下げ、収束値が1.0を超えないよう調整した。また強度スライダー(0〜3倍)で音声値が1.0を超えることがあるため、シェーダー内で `clamp(uVolume/uBass/uTreble, 0.0, 1.0)` してから使うようにした。
- 実機Chrome(開発サーバー上の2タブ)でシーン自動収集・Feedback Loop切替・強度調整・BroadcastChannel同期を確認済み。Fullscreen APIは検証環境の制約で未確認([specs/001-multi-window-projection.md](001-multi-window-projection.md)と同様)。
