import { rm } from "node:fs/promises";
import path from "node:path";

const apiDirectory = path.join(process.cwd(), "src", "pages", "api");
await rm(apiDirectory, { recursive: true, force: true });
console.log("Owner-only API routes removed from the public static build.");
