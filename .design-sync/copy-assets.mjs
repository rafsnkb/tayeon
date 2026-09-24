// Copies the app's root-absolute static assets into the bundle root.
//
// Components reference them with absolute paths — BrandBi uses
// /textures/bi_light.png. (The tier nebula backgrounds are gone as of
// 2026-09-25; pass cards use their own artwork under public/pass/.)
// Those resolve against the DS project root, so shipping public/textures/
// there makes the real images load in preview cards AND in designs the
// agent builds with this DS. Re-run after every package-build.mjs — the
// converter clears --out.
//
// Run: node .design-sync/copy-assets.mjs
import { cpSync } from "node:fs";

cpSync("public/textures", "ds-bundle/textures", { recursive: true });
console.log("copied public/textures -> ds-bundle/textures");
