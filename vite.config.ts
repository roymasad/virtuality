import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        app: new URL("./index.html", import.meta.url).pathname,
        screensaver: new URL("./screensaver.html", import.meta.url).pathname,
        settings: new URL("./settings.html", import.meta.url).pathname,
      },
    },
  },
});
