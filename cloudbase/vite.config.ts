import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cloudbaseRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: resolve(cloudbaseRoot, "frontend"),
  publicDir: resolve(cloudbaseRoot, "../public"),
  plugins: [react()],
  build: {
    outDir: resolve(cloudbaseRoot, "dist"),
    emptyOutDir: true,
    sourcemap: false,
  },
});
