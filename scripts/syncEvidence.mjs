import { execFile } from "node:child_process";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import Papa from "papaparse";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const evidenceRoot = path.join(root, "public", "evidence");
const treesPath = path.join(root, "storage", "Trees.csv");
const patchesPath = path.join(root, "storage", "Forest_Patch.csv");

const ignoredNames = new Set([".gitkeep", ".DS_Store", "Thumbs.db"]);
const ignoredPrefixes = ["."];

function parseCsv(text) {
  return Papa.parse(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  }).data;
}

function serializeCsv(records, columns, newline) {
  const normalized = records.map((record) =>
    Object.fromEntries(columns.map((column) => [column, record[column] ?? ""])),
  );
  return Papa.unparse(normalized, { columns, newline }) + newline;
}

async function listEvidenceFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (ignoredNames.has(entry.name)) continue;
      if (ignoredPrefixes.some((prefix) => entry.name.startsWith(prefix))) continue;

      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...await listEvidenceFiles(absolutePath));
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }

    return files;
  } catch {
    return [];
  }
}

async function earliestGitDate(filePath) {
  const relativePath = path.relative(root, filePath).replaceAll(path.sep, "/");
  try {
    const { stdout } = await execFileAsync("git", [
      "log",
      "--follow",
      "--format=%aI",
      "--reverse",
      "--",
      relativePath,
    ], { cwd: root });

    const firstDate = stdout.trim().split(/\r?\n/).find(Boolean);
    return firstDate ? firstDate.slice(0, 10) : "";
  } catch {
    return "";
  }
}

async function fallbackFileDate(filePath) {
  const details = await stat(filePath);
  const date = details.birthtimeMs > 0 ? details.birthtime : details.mtime;
  return date.toISOString().slice(0, 10);
}

async function getSproutedDate(files) {
  const dates = [];
  for (const file of files) {
    const gitDate = await earliestGitDate(file);
    dates.push(gitDate || await fallbackFileDate(file));
  }
  return dates.filter(Boolean).sort()[0] ?? "";
}

function getRepositoryEvidenceUrl(patchId, treeId) {
  const repository = process.env.GITHUB_REPOSITORY?.trim();
  const branch = process.env.GITHUB_REF_NAME?.trim() || "main";

  if (repository) {
    return `https://github.com/${repository}/tree/${branch}/public/evidence/${patchId}/${treeId}`;
  }

  return `evidence/${patchId}/${treeId}`;
}

const treeText = await readFile(treesPath, "utf8");
const patchText = await readFile(patchesPath, "utf8");
const newline = treeText.includes("\r\n") ? "\r\n" : "\n";
const patchNewline = patchText.includes("\r\n") ? "\r\n" : "\n";

const treeColumns = [
  "Tree_ID", "Patch_ID", "Tree_Name", "Tree_Description",
  "Date_Planted", "Date_Sprouted", "Growth_Stage",
  "Display_Slot", "Evidence_Path",
];
const patchColumns = [
  "Patch_ID", "Patch_Name", "Patch_Style", "Patch_Order",
  "Hex_Q", "Hex_R", "Saplings_Planted", "Trees_Grown",
  "Patch_Description", "Date_Created", "Last_Updated",
];

const trees = parseCsv(treeText).filter((tree) => tree.Tree_ID?.trim() && tree.Patch_ID?.trim());
const patches = parseCsv(patchText).filter((patch) => patch.Patch_ID?.trim());

for (const tree of trees) {
  const patchId = tree.Patch_ID.trim();
  const treeId = tree.Tree_ID.trim();
  const directory = path.join(evidenceRoot, patchId, treeId);
  const files = await listEvidenceFiles(directory);

  if (files.length > 0) {
    tree.Growth_Stage = "TREE";
    tree.Date_Sprouted = await getSproutedDate(files);
    tree.Evidence_Path = getRepositoryEvidenceUrl(patchId, treeId);
  } else {
    tree.Growth_Stage = "SAPLING";
    tree.Date_Sprouted = "";
    tree.Evidence_Path = `evidence/${patchId}/${treeId}`;
  }
}

const today = new Date().toISOString().slice(0, 10);
for (const patch of patches) {
  const patchTrees = trees.filter((tree) => tree.Patch_ID.trim() === patch.Patch_ID.trim());
  patch.Saplings_Planted = String(patchTrees.filter((tree) => tree.Growth_Stage === "SAPLING").length);
  patch.Trees_Grown = String(patchTrees.filter((tree) => tree.Growth_Stage === "TREE").length);
  patch.Last_Updated = today;
}

await Promise.all([
  writeFile(treesPath, serializeCsv(trees, treeColumns, newline), "utf8"),
  writeFile(patchesPath, serializeCsv(patches, patchColumns, patchNewline), "utf8"),
]);

console.log(`Evidence synchronized: ${trees.length} tree record(s), ${patches.length} patch record(s).`);
