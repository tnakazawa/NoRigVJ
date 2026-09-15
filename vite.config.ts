import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ command }) => ({
  // GitHub Pages(https://tnakazawa.github.io/NoRigVJ/)はリポジトリ名のサブパスで配信されるため、
  // ビルド時のみbaseを合わせる(開発サーバーは従来通りルート直下で動かす)
  base: command === "build" ? "/NoRigVJ/" : "/",
  build: {
    rollupOptions: {
      input: {
        // GitHub Pagesのルート(https://tnakazawa.github.io/NoRigVJ/)へ直接アクセスされた際に
        // control.htmlへ誘導するためのリダイレクト用ページ
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        control: fileURLToPath(new URL("./control.html", import.meta.url)),
        display: fileURLToPath(new URL("./display.html", import.meta.url)),
      },
    },
  },
}));
