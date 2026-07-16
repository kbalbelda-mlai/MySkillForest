import Papa from "papaparse";
import forestPatchCsv from "../data/Forest_Patch.csv?raw";
import treesCsv from "../data/Trees.csv?raw";

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
  Growth_Stage: "SAPLING" | "TREE";
  Display_Slot: number;
  Evidence_Path: string;
}

export function loadTrees(): TreeRecord[] {
  const parsed = Papa.parse<Record<string, string>>(treesCsv, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.error("Trees.csv parsing errors:", parsed.errors);
  }

  return parsed.data.map((row) => ({
    Tree_ID: row.Tree_ID,
    Patch_ID: row.Patch_ID,
    Tree_Name: row.Tree_Name,
    Tree_Description: row.Tree_Description,
    Date_Planted: row.Date_Planted,
    Date_Sprouted: row.Date_Sprouted,
    Growth_Stage: row.Growth_Stage as "SAPLING" | "TREE",
    Display_Slot: Number(row.Display_Slot),
    Evidence_Path: row.Evidence_Path,
  }));
}

export function loadForestPatches(): ForestPatchRecord[] {
  const parsed = Papa.parse<Record<string, string>>(forestPatchCsv, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.error("Forest_Patch.csv parsing errors:", parsed.errors);
  }

  return parsed.data.map((row) => ({
    Patch_ID: row.Patch_ID,
    Patch_Name: row.Patch_Name,
    Patch_Style: row.Patch_Style.padStart(2, "0"),
    Patch_Order: Number(row.Patch_Order),
    Hex_Q: Number(row.Hex_Q),
    Hex_R: Number(row.Hex_R),
    Saplings_Planted: Number(row.Saplings_Planted),
    Trees_Grown: Number(row.Trees_Grown),
    Patch_Description: row.Patch_Description,
    Date_Created: row.Date_Created,
    Last_Updated: row.Last_Updated,
  }));
}