// Post-build step for `npm run build:single`.
// Copies the single-file bundle to project root as LiftOpt.html so users can
// double-click to open — no dev server, no npm required at runtime.

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const source = join(projectRoot, "dist-single", "index.html");
const target = join(projectRoot, "LiftOpt.html");

const html = readFileSync(source, "utf8");
writeFileSync(target, html);

const kb = (statSync(target).size / 1024).toFixed(0);
console.log(`\n✔ Wrote ${target}`);
console.log(`  Size: ${kb} KB (self-contained — open in any modern browser)\n`);
