import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "src", "owner-api");
const destination = path.join(root, "src", "pages", "api");

await mkdir(destination, { recursive: true });
await Promise.all([
  cp(path.join(source, "patches.ts"), path.join(destination, "patches.ts")),
  cp(path.join(source, "trees.ts"), path.join(destination, "trees.ts")),
]);

console.log("Owner API routes restored for local development.");
