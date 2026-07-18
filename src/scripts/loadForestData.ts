import Papa from "papaparse";

import forestPatchCsv from "../data/Forest_Patch.csv?raw";
import treesCsv from "../data/Trees.csv?raw";

/* =========================================================
   DATA TYPES
   ========================================================= */

export type GrowthStage = "SAPLING" | "TREE";

export interface ForestPatchRecord {
  Patch_ID: string;
  Patch_Name: string;
  Patch_Style: string;
  Patch_Order: number;
  Hex_Q: number;
  Hex_R: number;
  Saplings_Planted: number;
  Trees_Grown: number;
  Patch_Description: string;
  Date_Created: string;
  Last_Updated: string;
}

export interface TreeRecord {
  Tree_ID: string;
  Patch_ID: string;
  Tree_Name: string;
  Tree_Description: string;
  Date_Planted: string;
  Date_Sprouted: string;
  Growth_Stage: GrowthStage;
  Display_Slot: number;
  Evidence_Path: string;
}

export interface ForestStatistics {
  patchCount: number;
  saplingCount: number;
  treeCount: number;
  totalTreeCount: number;
}

export interface TreeSearchRecord {
  treeId: string;
  treeName: string;
  patchId: string;
  patchName: string;
  normalizedTreeName: string;
  normalizedPatchName: string;
}

export interface ForestData {
  patches: ForestPatchRecord[];
  trees: TreeRecord[];
  statistics: ForestStatistics;
  treeSearchIndex: TreeSearchRecord[];
}

/* =========================================================
   INTERNAL HELPERS
   ========================================================= */

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeNumber(
  value: unknown,
  fallback = 0,
): number {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue)
    ? parsedValue
    : fallback;
}

function normalizePatchStyle(value: unknown): string {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "01";
  }

  return normalizedValue.padStart(2, "0");
}

function normalizeGrowthStage(
  value: unknown,
): GrowthStage {
  const normalizedValue = normalizeText(value).toUpperCase();

  return normalizedValue === "TREE"
    ? "TREE"
    : "SAPLING";
}

function parseCsv(
  csvText: string,
  fileName: string,
): Record<string, string>[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    console.error(
      `${fileName} parsing errors:`,
      parsed.errors,
    );
  }

  console.log(
    `${fileName}: ${parsed.data.length} raw record(s) loaded.`,
  );

  return parsed.data;
}

function isValidPatchRow(
  row: Record<string, string>,
): boolean {
  return normalizeText(row.Patch_ID).length > 0;
}

function isValidTreeRow(
  row: Record<string, string>,
): boolean {
  return (
    normalizeText(row.Tree_ID).length > 0 &&
    normalizeText(row.Patch_ID).length > 0
  );
}

/* =========================================================
   FOREST PATCH LOADER
   ========================================================= */

export function loadForestPatches(): ForestPatchRecord[] {
  const rows = parseCsv(
    forestPatchCsv,
    "Forest_Patch.csv",
  );

  const patches = rows
    .filter(isValidPatchRow)
    .map((row): ForestPatchRecord => ({
      Patch_ID: normalizeText(row.Patch_ID),

      Patch_Name:
        normalizeText(row.Patch_Name) ||
        `Forest Patch ${normalizeText(row.Patch_ID)}`,

      Patch_Style: normalizePatchStyle(
        row.Patch_Style,
      ),

      Patch_Order: normalizeNumber(
        row.Patch_Order,
      ),

      Hex_Q: normalizeNumber(row.Hex_Q),

      Hex_R: normalizeNumber(row.Hex_R),

      Saplings_Planted: normalizeNumber(
        row.Saplings_Planted,
      ),

      Trees_Grown: normalizeNumber(
        row.Trees_Grown,
      ),

      Patch_Description: normalizeText(
        row.Patch_Description,
      ),

      Date_Created: normalizeText(
        row.Date_Created,
      ),

      Last_Updated: normalizeText(
        row.Last_Updated,
      ),
    }))
    .sort((firstPatch, secondPatch) => {
      return (
        firstPatch.Patch_Order -
        secondPatch.Patch_Order
      );
    });

  console.log(
    `Forest_Patch.csv: ${patches.length} valid patch record(s) loaded.`,
  );

  return patches;
}

/* =========================================================
   TREE LOADER
   ========================================================= */

export function loadTrees(): TreeRecord[] {
  const rows = parseCsv(
    treesCsv,
    "Trees.csv",
  );

  const trees = rows
    .filter(isValidTreeRow)
    .map((row): TreeRecord => ({
      Tree_ID: normalizeText(row.Tree_ID),

      Patch_ID: normalizeText(row.Patch_ID),

      Tree_Name:
        normalizeText(row.Tree_Name) ||
        "Unnamed Tree",

      Tree_Description: normalizeText(
        row.Tree_Description,
      ),

      Date_Planted: normalizeText(
        row.Date_Planted,
      ),

      Date_Sprouted: normalizeText(
        row.Date_Sprouted,
      ),

      Growth_Stage: normalizeGrowthStage(
        row.Growth_Stage,
      ),

      Display_Slot: normalizeNumber(
        row.Display_Slot,
      ),

      Evidence_Path: normalizeText(
        row.Evidence_Path,
      ),
    }))
    .sort((firstTree, secondTree) => {
      if (firstTree.Patch_ID !== secondTree.Patch_ID) {
        return firstTree.Patch_ID.localeCompare(
          secondTree.Patch_ID,
          undefined,
          {
            numeric: true,
          },
        );
      }

      return (
        firstTree.Display_Slot -
        secondTree.Display_Slot
      );
    });

  console.log(
    `Trees.csv: ${trees.length} valid tree record(s) loaded.`,
  );

  return trees;
}

/* =========================================================
   STATISTICS
   ========================================================= */

export function getForestStatistics(
  patches: ForestPatchRecord[],
  trees: TreeRecord[],
): ForestStatistics {
  const saplingCount = trees.filter(
    (tree) => tree.Growth_Stage === "SAPLING",
  ).length;

  const treeCount = trees.filter(
    (tree) => tree.Growth_Stage === "TREE",
  ).length;

  return {
    patchCount: patches.length,
    saplingCount,
    treeCount,
    totalTreeCount: trees.length,
  };
}

/* =========================================================
   TREE SEARCH INDEX
   ========================================================= */

export function buildTreeSearchIndex(
  patches: ForestPatchRecord[],
  trees: TreeRecord[],
): TreeSearchRecord[] {
  const patchNamesById = new Map<string, string>();

  for (const patch of patches) {
    patchNamesById.set(
      patch.Patch_ID,
      patch.Patch_Name,
    );
  }

  return trees
    .map((tree): TreeSearchRecord => {
      const patchName =
        patchNamesById.get(tree.Patch_ID) ??
        "Unknown Forest Patch";

      return {
        treeId: tree.Tree_ID,
        treeName: tree.Tree_Name,
        patchId: tree.Patch_ID,
        patchName,
        normalizedTreeName:
          tree.Tree_Name.toLocaleLowerCase(),
        normalizedPatchName:
          patchName.toLocaleLowerCase(),
      };
    })
    .sort((firstTree, secondTree) => {
      return firstTree.treeName.localeCompare(
        secondTree.treeName,
      );
    });
}

/* =========================================================
   COMPLETE FOREST DATA
   ========================================================= */

export function loadForestData(): ForestData {
  const patches = loadForestPatches();
  const trees = loadTrees();

  const statistics = getForestStatistics(
    patches,
    trees,
  );

  const treeSearchIndex =
    buildTreeSearchIndex(
      patches,
      trees,
    );

  console.log("Complete forest data loaded:", {
    patchCount: statistics.patchCount,
    saplingCount: statistics.saplingCount,
    treeCount: statistics.treeCount,
    totalTreeCount: statistics.totalTreeCount,
    searchRecordCount: treeSearchIndex.length,
  });

  return {
    patches,
    trees,
    statistics,
    treeSearchIndex,
  };
}