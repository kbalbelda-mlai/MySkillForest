import {
  access,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";

import path from "node:path";
import Papa from "papaparse";

import type {
  ForestPatchRecord,
  TreeRecord,
} from "./loadForestData";

import { readForestPatchCsv } from "./csvWriter";
import {
  deleteTreeEvidenceFolder,
  ensureTreeEvidenceFolder,
} from "./evidenceStorage";

const TREES_CSV_PATH = path.join(process.cwd(), "storage", "Trees.csv");
const PATCH_CSV_PATH = path.join(process.cwd(), "storage", "Forest_Patch.csv");

const TREE_HEADERS = [
  "Tree_ID", "Patch_ID", "Tree_Name", "Tree_Description",
  "Date_Planted", "Date_Sprouted", "Growth_Stage",
  "Display_Slot", "Evidence_Path",
] as const;

const PATCH_HEADERS = [
  "Patch_ID", "Patch_Name", "Patch_Style", "Patch_Order",
  "Hex_Q", "Hex_R", "Saplings_Planted", "Trees_Grown",
  "Patch_Description", "Date_Created", "Last_Updated",
] as const;

export interface PlantTreeInput {
  Patch_ID: string;
  Tree_Name: string;
  Tree_Description: string;
  Date_Planted: string;
}

export interface EditTreeInput extends PlantTreeInput {
  Tree_ID: string;
}

export interface PlantTreeResult {
  tree: TreeRecord;
  patch: ForestPatchRecord;
}

export interface DeleteTreeResult {
  treeId: string;
  patch: ForestPatchRecord;
}

export interface TreeValidationResult {
  isValid: boolean;
  field?: "Patch_ID" | "Tree_ID" | "Tree_Name" | "Tree_Description" | "Date_Planted" | "Display_Slot" | "Request";
  message?: string;
}

const getCurrentDate = (): string => new Date().toISOString().slice(0, 10);

function isValidDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);
}

export function validatePlantTreeInput(
  input: PlantTreeInput,
): TreeValidationResult {
  const patchId = input.Patch_ID.trim();
  const treeName = input.Tree_Name.trim().replace(/\s+/g, " ");
  const description = input.Tree_Description.trim();
  const datePlanted = input.Date_Planted.trim();

  if (!patchId) return { isValid: false, field: "Patch_ID", message: "A forest patch is required." };
  if (!treeName) return { isValid: false, field: "Tree_Name", message: "Enter a tree name." };
  if (treeName.length > 50) return { isValid: false, field: "Tree_Name", message: "Tree names cannot exceed 50 characters." };
  if (description.length > 250) return { isValid: false, field: "Tree_Description", message: "Tree descriptions cannot exceed 250 characters." };
  if (!datePlanted || !isValidDate(datePlanted)) return { isValid: false, field: "Date_Planted", message: "Choose a valid planting date." };
  return { isValid: true };
}

export async function readTreesCsv(): Promise<TreeRecord[]> {
  try { await access(TREES_CSV_PATH); } catch { return []; }
  const csvText = await readFile(TREES_CSV_PATH, "utf8");
  const parsed = Papa.parse<Record<string, string>>(
    csvText.replace(/^\uFEFF/, ""),
    { header: true, skipEmptyLines: "greedy", transformHeader: (header) => header.trim() },
  );

  return parsed.data
    .filter((row) => row.Tree_ID?.trim() && row.Patch_ID?.trim())
    .map((row) => ({
      Tree_ID: row.Tree_ID.trim(),
      Patch_ID: row.Patch_ID.trim(),
      Tree_Name: row.Tree_Name?.trim() || "Unnamed Tree",
      Tree_Description: row.Tree_Description?.trim() || "",
      Date_Planted: row.Date_Planted?.trim() || "",
      Date_Sprouted: row.Date_Sprouted?.trim() || "",
      Growth_Stage: row.Growth_Stage?.trim().toUpperCase() === "TREE" ? "TREE" : "SAPLING",
      Display_Slot: Number(row.Display_Slot) || 0,
      Evidence_Path: row.Evidence_Path?.trim() || "",
    }));
}

function normalizeTreeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function getNextTreeId(trees: readonly TreeRecord[]): string {
  const highest = trees.reduce((value, tree) => {
    const match = tree.Tree_ID.match(/^T(\d+)$/i);
    return match ? Math.max(value, Number(match[1])) : value;
  }, 0);
  return `T${highest + 1}`;
}

function getAvailableSlot(patchId: string, trees: readonly TreeRecord[]): number | null {
  const occupied = new Set(
    trees.filter((tree) => tree.Patch_ID === patchId).map((tree) => tree.Display_Slot),
  );
  for (let slot = 1; slot <= 20; slot += 1) {
    if (!occupied.has(slot)) return slot;
  }
  return null;
}

function serializeCsv(
  headers: readonly string[],
  records: readonly object[],
  lineEnding: string,
): string {
  const normalizedRecords = records.map((record) => {
    const source = record as Record<string, unknown>;
    return Object.fromEntries(headers.map((header) => [header, source[header] ?? ""]));
  });
  return Papa.unparse(normalizedRecords, { columns: [...headers], newline: lineEnding }) + lineEnding;
}

async function writeTreesAndPatches(
  trees: readonly TreeRecord[],
  patches: readonly ForestPatchRecord[],
): Promise<void> {
  const [treeCsvText, patchCsvText] = await Promise.all([
    readFile(TREES_CSV_PATH, "utf8").catch(() => ""),
    readFile(PATCH_CSV_PATH, "utf8"),
  ]);
  const treeLineEnding = treeCsvText.includes("\r\n") ? "\r\n" : "\n";
  const patchLineEnding = patchCsvText.includes("\r\n") ? "\r\n" : "\n";
  const treesTempPath = `${TREES_CSV_PATH}.tmp`;
  const patchTempPath = `${PATCH_CSV_PATH}.tmp`;

  await Promise.all([
    writeFile(treesTempPath, serializeCsv(TREE_HEADERS, trees, treeLineEnding), "utf8"),
    writeFile(patchTempPath, serializeCsv(PATCH_HEADERS, patches, patchLineEnding), "utf8"),
  ]);
  await rename(treesTempPath, TREES_CSV_PATH);
  await rename(patchTempPath, PATCH_CSV_PATH);
}

function updatePatchCounts(
  patch: ForestPatchRecord,
  trees: readonly TreeRecord[],
): ForestPatchRecord {
  const patchTrees = trees.filter((tree) => tree.Patch_ID === patch.Patch_ID);
  return {
    ...patch,
    Saplings_Planted: patchTrees.filter((tree) => tree.Growth_Stage === "SAPLING").length,
    Trees_Grown: patchTrees.filter((tree) => tree.Growth_Stage === "TREE").length,
    Last_Updated: getCurrentDate(),
  };
}

export async function plantTreeInCsv(
  input: PlantTreeInput,
): Promise<PlantTreeResult> {
  const validation = validatePlantTreeInput(input);
  if (!validation.isValid) throw new Error(validation.message ?? "The tree could not be planted.");

  const [trees, patches] = await Promise.all([readTreesCsv(), readForestPatchCsv()]);
  const patchId = input.Patch_ID.trim();
  const patchIndex = patches.findIndex((patch) => patch.Patch_ID === patchId);
  if (patchIndex < 0) throw new Error(`Patch "${patchId}" was not found.`);

  const normalizedName = normalizeTreeName(input.Tree_Name);
  if (trees.some((tree) => tree.Patch_ID === patchId && normalizeTreeName(tree.Tree_Name) === normalizedName)) {
    throw new Error("A tree with this name already exists in this forest patch.");
  }

  const displaySlot = getAvailableSlot(patchId, trees);
  if (displaySlot === null) throw new Error("This forest patch already contains 20 trees.");

  const treeId = getNextTreeId(trees);
  const evidencePath = await ensureTreeEvidenceFolder(patchId, treeId);
  const newTree: TreeRecord = {
    Tree_ID: treeId,
    Patch_ID: patchId,
    Tree_Name: input.Tree_Name.trim().replace(/\s+/g, " "),
    Tree_Description: input.Tree_Description.trim(),
    Date_Planted: input.Date_Planted.trim(),
    Date_Sprouted: "",
    Growth_Stage: "SAPLING",
    Display_Slot: displaySlot,
    Evidence_Path: evidencePath,
  };

  const updatedTrees = [...trees, newTree];
  const updatedPatch = updatePatchCounts(patches[patchIndex], updatedTrees);
  const updatedPatches = [...patches];
  updatedPatches[patchIndex] = updatedPatch;
  await writeTreesAndPatches(updatedTrees, updatedPatches);
  return { tree: newTree, patch: updatedPatch };
}

export async function editTreeInCsv(
  input: EditTreeInput,
): Promise<PlantTreeResult> {
  const validation = validatePlantTreeInput(input);
  if (!validation.isValid) throw new Error(validation.message ?? "The tree could not be updated.");

  const [trees, patches] = await Promise.all([readTreesCsv(), readForestPatchCsv()]);
  const treeId = input.Tree_ID.trim();
  const treeIndex = trees.findIndex((tree) => tree.Tree_ID === treeId);
  if (treeIndex < 0) throw new Error(`Tree "${treeId}" was not found.`);

  const existingTree = trees[treeIndex];
  if (existingTree.Patch_ID !== input.Patch_ID.trim()) {
    throw new Error("The selected tree does not belong to the requested patch.");
  }

  const normalizedName = normalizeTreeName(input.Tree_Name);
  if (trees.some((tree) =>
    tree.Tree_ID !== treeId &&
    tree.Patch_ID === existingTree.Patch_ID &&
    normalizeTreeName(tree.Tree_Name) === normalizedName,
  )) {
    throw new Error("A tree with this name already exists in this forest patch.");
  }

  const updatedTree: TreeRecord = {
    ...existingTree,
    Tree_Name: input.Tree_Name.trim().replace(/\s+/g, " "),
    Tree_Description: input.Tree_Description.trim(),
    Date_Planted: input.Date_Planted.trim(),
  };

  const updatedTrees = [...trees];
  updatedTrees[treeIndex] = updatedTree;
  const patch = patches.find((record) => record.Patch_ID === existingTree.Patch_ID);
  if (!patch) throw new Error(`Patch "${existingTree.Patch_ID}" was not found.`);
  await writeTreesAndPatches(updatedTrees, patches);
  return { tree: updatedTree, patch };
}

export async function deleteTreeInCsv(
  treeIdInput: string,
): Promise<DeleteTreeResult> {
  const [trees, patches] = await Promise.all([readTreesCsv(), readForestPatchCsv()]);
  const treeId = treeIdInput.trim();
  const tree = trees.find((record) => record.Tree_ID === treeId);
  if (!tree) throw new Error(`Tree "${treeId}" was not found.`);

  const patchIndex = patches.findIndex((patch) => patch.Patch_ID === tree.Patch_ID);
  if (patchIndex < 0) throw new Error(`Patch "${tree.Patch_ID}" was not found.`);

  const updatedTrees = trees.filter((record) => record.Tree_ID !== treeId);
  const updatedPatch = updatePatchCounts(patches[patchIndex], updatedTrees);
  const updatedPatches = [...patches];
  updatedPatches[patchIndex] = updatedPatch;

  await writeTreesAndPatches(updatedTrees, updatedPatches);
  await deleteTreeEvidenceFolder(tree.Patch_ID, tree.Tree_ID, tree.Evidence_Path);
  return { treeId, patch: updatedPatch };
}
