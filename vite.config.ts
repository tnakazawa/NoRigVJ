import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        control: fileURLToPath(new URL("./control.html", import.meta.url)),
        display: fileURLToPath(new URL("./display.html", import.meta.url)),
      },
    },
  },
});
