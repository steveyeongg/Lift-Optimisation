var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a, _b;
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
// Two build modes:
//  • `npm run build`         → standard multi-file dist for dev/preview
//  • `npm run build:single`  → single-file LiftOpt.html you can double-click
// eslint-disable-next-line @typescript-eslint/no-explicit-any
var single = ((_b = (_a = globalThis.process) === null || _a === void 0 ? void 0 : _a.env) === null || _b === void 0 ? void 0 : _b.LIFTOPT_SINGLEFILE) === "1";
export default defineConfig({
    plugins: __spreadArray([react()], (single ? [viteSingleFile()] : []), true),
    server: { port: 5173 },
    build: single
        ? {
            outDir: "dist-single",
            assetsInlineLimit: 100000000, // inline any asset
            cssCodeSplit: false,
            chunkSizeWarningLimit: 100000000,
            rollupOptions: {
                output: {
                    inlineDynamicImports: true,
                    manualChunks: undefined,
                },
            },
        }
        : undefined,
});
