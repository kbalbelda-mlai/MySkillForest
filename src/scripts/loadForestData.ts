import Papa from "papaparse";
import forestPatchCsv from "../data/Forest_Patch.csv?raw";

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