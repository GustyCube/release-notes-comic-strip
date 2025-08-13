import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });

// Dynamic import built JS
const planner = await import(path.join(root, "dist", "planner.js"));
const images = await import(path.join(root, "dist", "images.js"));
const compose = await import(path.join(root, "dist", "compose.js"));

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "test.json"), "utf-8"));
const prs = data.prs;
const style = data.style || "retro";
const persona = data.persona || "noir";

console.log("Planning panels...");
const plan = await planner.planPanels(prs, style, persona);
console.log("Plan:", plan);

console.log("Rendering 4 panels...");
const panels = await images.renderPanels(plan.panels, path.join(outDir, "panels"), style);

console.log("Stitching 1x4...");
const outPng = path.join(outDir, "comic-1x4.png");
await compose.stitch1x4(panels, outPng, plan.title, plan.panels, plan.selectedPRs);
console.log("Done ->", outPng);
