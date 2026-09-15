import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ command }) => ({
  // GitHub Pages(https://tnakazawa.github.io/NoRigVJ/)はリポジトリ名のサブパスで配信されるため、
  // ビルド時のみbaseを合わせる(開発サーバーは従来通りルート直下で動かす)
  base: command === "build" ? "/NoRigVJ/" : "/",
  build: {
    rollupOptions: {
      input: {
        control: fileURLToPath(new URL("./control.html", import.meta.url)),
        display: fileURLToPath(new URL("./display.html", import.meta.url)),
      },
    },
  },
}));
