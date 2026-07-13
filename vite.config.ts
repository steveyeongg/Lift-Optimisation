import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Two build modes:
//  • `npm run build`         → standard multi-file dist for dev/preview
//  • `npm run build:single`  → single-file LiftOpt.html you can double-click
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const single = (globalThis as any).process?.env?.LIFTOPT_SINGLEFILE === "1";

export default defineConfig({
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  server: { port: 5173 },
  build: single
    ? {
        outDir: "dist-single",
        assetsInlineLimit: 100_000_000, // inline any asset
        cssCodeSplit: false,
        chunkSizeWarningLimit: 100_000_000,
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
            manualChunks: undefined,
          },
        },
      }
    : undefined,
});
