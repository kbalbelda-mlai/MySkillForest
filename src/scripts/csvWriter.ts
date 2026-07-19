import {
  access,
  appendFile,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

import Papa from "papaparse";

import {
  deletePatchEvidenceFolder,
  ensurePatchEvidenceFolder,
} from "./evidenceStorage";

import { generateHexSpiral } from "./hexSpiral";

import type {
  ForestPatchRecord,
  TreeRecord,
} from "./loadForestData";

/* =========================================================
   CSV CONFIGURATION
   ========================================================= */

const FOREST_PATCH_HEADERS = [
  "Patch_ID",
  "Patch_Name",
  "Patch_Style",
  "Patch_Order",
  "Hex_Q",
  "Hex_R",
  "Saplings_Planted",
  "Trees_Grown",
  "Patch_Description",
  "Date_Created",
  "Last_Updated",
] as const;

const FOREST_PATCH_CSV_PATH =
  path.join(
    process.cwd(),
    "storage",
    "Forest_Patch.csv",
  );

/* =========================================================
   TYPES
   ========================================================= */

export interface PatchValidationResult {
  isValid: boolean;

  field?:
    | "Patch_ID"
    | "Patch_Name"
    | "Patch_Order"
    | "Hex_Coordinate";

  message?: string;
}

/* =========================================================
   CSV ESCAPING
   ========================================================= */

function escapeCsvValue(
  value:
    | string
    | number
    | null
    | undefined,
): string {
  const normalizedValue =
    value === null ||
    value === undefined
      ? ""
      : String(value);

  const escapedValue =
    normalizedValue.replace(
      /"/g,
      '""',
    );

  const requiresQuotes =
    escapedValue.includes(",") ||
    escapedValue.includes('"') ||
    escapedValue.includes("\n") ||
    escapedValue.includes("\r");

  return requiresQuotes
    ? `"${escapedValue}"`
    : escapedValue;
}

/* =========================================================
   CSV PARSING
   ========================================================= */

function parseCsvRows(
  csvText: string,
): string[][] {
  const rows: string[][] = [];

  let currentRow: string[] = [];
  let currentValue = "";
  let isInsideQuotes = false;

  for (
    let index = 0;
    index < csvText.length;
    index += 1
  ) {
    const character =
      csvText[index];

    const nextCharacter =
      csvText[index + 1];

    if (
      character === '"'
    ) {
      if (
        isInsideQuotes &&
        nextCharacter === '"'
      ) {
        currentValue += '"';
        index += 1;
      } else {
        isInsideQuotes =
          !isInsideQuotes;
      }

      continue;
    }

    if (
      character === "," &&
      !isInsideQuotes
    ) {
      currentRow.push(
        currentValue,
      );

      currentValue = "";

      continue;
    }

    if (
      (
        character === "\n" ||
        character === "\r"
      ) &&
      !isInsideQuotes
    ) {
      if (
        character === "\r" &&
        nextCharacter === "\n"
      ) {
        index += 1;
      }

      currentRow.push(
        currentValue,
      );

      const hasContent =
        currentRow.some(
          (value) =>
            value.trim() !== "",
        );

      if (hasContent) {
        rows.push(
          currentRow,
        );
      }

      currentRow = [];
      currentValue = "";

      continue;
    }

    currentValue += character;
  }

  if (
    currentValue.length > 0 ||
    currentRow.length > 0
  ) {
    currentRow.push(
      currentValue,
    );

    const hasContent =
      currentRow.some(
        (value) =>
          value.trim() !== "",
      );

    if (hasContent) {
      rows.push(
        currentRow,
      );
    }
  }

  return rows;
}

/* =========================================================
   NORMALIZATION
   ========================================================= */

function normalizePatchName(
  patchName: string,
): string {
  return patchName
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function parseInteger(
  value: string,
): number {
  const parsedValue =
    Number.parseInt(
      value.trim(),
      10,
    );

  return Number.isFinite(
    parsedValue,
  )
    ? parsedValue
    : 0;
}

/* =========================================================
   READ PATCH CSV
   ========================================================= */

export async function readForestPatchCsv():
  Promise<ForestPatchRecord[]> {
  try {
    await access(
      FOREST_PATCH_CSV_PATH,
    );
  } catch {
    console.warn(
      "Forest_Patch.csv was not found:",
      FOREST_PATCH_CSV_PATH,
    );

    return [];
  }

  const csvText =
    await readFile(
      FOREST_PATCH_CSV_PATH,
      "utf8",
    );

  const rows =
    parseCsvRows(
      csvText,
    );

  if (
    rows.length === 0
  ) {
    return [];
  }

  const headers =
    rows[0].map(
      (header) =>
        header.trim(),
    );

  const records:
    ForestPatchRecord[] = [];

  for (
    const row of
    rows.slice(1)
  ) {
    const rowRecord:
      Record<string, string> = {};

    headers.forEach(
      (
        header,
        index,
      ) => {
        rowRecord[header] =
          row[index] ?? "";
      },
    );

    const patchId =
      rowRecord.Patch_ID?.trim();

    if (!patchId) {
      continue;
    }

    records.push({
      Patch_ID:
        patchId,

      Patch_Name:
        rowRecord.Patch_Name?.trim() ??
        "",

      Patch_Style:
        (
          rowRecord.Patch_Style?.trim() ||
          "01"
        ).padStart(2, "0"),

      Patch_Order:
        parseInteger(
          rowRecord.Patch_Order ??
          "",
        ),

      Hex_Q:
        parseInteger(
          rowRecord.Hex_Q ??
          "",
        ),

      Hex_R:
        parseInteger(
          rowRecord.Hex_R ??
          "",
        ),

      Saplings_Planted:
        parseInteger(
          rowRecord.Saplings_Planted ??
          "",
        ),

      Trees_Grown:
        parseInteger(
          rowRecord.Trees_Grown ??
          "",
        ),

      Patch_Description:
        rowRecord.Patch_Description?.trim() ??
        "",

      Date_Created:
        rowRecord.Date_Created?.trim() ??
        "",

      Last_Updated:
        rowRecord.Last_Updated?.trim() ??
        "",
    });
  }

  console.log(
    "Forest patch CSV read:",
    {
      path:
        FOREST_PATCH_CSV_PATH,

      patchCount:
        records.length,
    },
  );

  return records;
}

/* =========================================================
   PATCH VALIDATION

   Duplicate patch names are checked after trimming,
   collapsing repeated spaces, and converting to lowercase.

   Examples treated as duplicates:
   - Machine Learning
   - machine learning
   - Machine   Learning
   ========================================================= */

export function validatePatchForCsv(
  patch: ForestPatchRecord,

  existingPatches:
    readonly ForestPatchRecord[],
):
  PatchValidationResult {
  const patchId =
    patch.Patch_ID.trim();

  const patchName =
    patch.Patch_Name.trim();

  if (!patchId) {
    return {
      isValid: false,
      field: "Patch_ID",
      message:
        "Patch ID is required.",
    };
  }

  if (!patchName) {
    return {
      isValid: false,
      field: "Patch_Name",
      message:
        "Enter a patch name.",
    };
  }

  const normalizedPatchName =
    normalizePatchName(
      patchName,
    );

  const duplicateId =
    existingPatches.some(
      (existingPatch) =>
        existingPatch.Patch_ID.trim() ===
        patchId,
    );

  if (duplicateId) {
    return {
      isValid: false,
      field: "Patch_ID",
      message:
        `Patch ID "${patchId}" already exists.`,
    };
  }

  const duplicateName =
    existingPatches.some(
      (existingPatch) =>
        normalizePatchName(
          existingPatch.Patch_Name,
        ) ===
        normalizedPatchName,
    );

  if (duplicateName) {
    return {
      isValid: false,
      field: "Patch_Name",
      message:
        "A patch with this name already exists.",
    };
  }

  const duplicateOrder =
    existingPatches.some(
      (existingPatch) =>
        existingPatch.Patch_Order ===
        patch.Patch_Order,
    );

  if (duplicateOrder) {
    return {
      isValid: false,
      field: "Patch_Order",
      message:
        `Patch order ${patch.Patch_Order} is already assigned.`,
    };
  }

  const duplicateCoordinate =
    existingPatches.some(
      (existingPatch) =>
        existingPatch.Hex_Q ===
          patch.Hex_Q &&
        existingPatch.Hex_R ===
          patch.Hex_R,
    );

  if (duplicateCoordinate) {
    return {
      isValid: false,
      field:
        "Hex_Coordinate",

      message:
        `Hex coordinate (${patch.Hex_Q}, ${patch.Hex_R}) is already occupied.`,
    };
  }

  return {
    isValid: true,
  };
}

/* =========================================================
   CONVERT PATCH TO CSV ROW
   ========================================================= */

function createForestPatchCsvRow(
  patch: ForestPatchRecord,
): string {
  return FOREST_PATCH_HEADERS
    .map(
      (header) =>
        escapeCsvValue(
          patch[header],
        ),
    )
    .join(",");
}

/* =========================================================
   ENSURE CSV EXISTS
   ========================================================= */

async function ensureForestPatchCsv():
  Promise<void> {
  try {
    await access(
      FOREST_PATCH_CSV_PATH,
    );
  } catch {
    const headerRow =
      FOREST_PATCH_HEADERS.join(
        ",",
      );

    await writeFile(
      FOREST_PATCH_CSV_PATH,
      `${headerRow}\n`,
      "utf8",
    );

    console.log(
      "Forest_Patch.csv created:",
      FOREST_PATCH_CSV_PATH,
    );
  }
}

/* =========================================================
   APPEND PATCH
   ========================================================= */

export async function appendForestPatchToCsv(
  patch: ForestPatchRecord,
): Promise<ForestPatchRecord> {
  await ensureForestPatchCsv();

  const existingPatches =
    await readForestPatchCsv();

  const validation =
    validatePatchForCsv(
      patch,
      existingPatches,
    );

  if (!validation.isValid) {
    throw new Error(
      validation.message ??
      "The patch could not be saved.",
    );
  }

  const normalizedPatch:
    ForestPatchRecord = {
    ...patch,

    Patch_ID:
      patch.Patch_ID.trim(),

    Patch_Name:
      patch.Patch_Name
        .trim()
        .replace(/\s+/g, " "),

    Patch_Style:
      patch.Patch_Style
        .trim()
        .padStart(2, "0"),

    Patch_Description:
      patch.Patch_Description.trim(),
  };

  const csvRow =
    createForestPatchCsvRow(
      normalizedPatch,
    );

  const existingCsvText =
    await readFile(
      FOREST_PATCH_CSV_PATH,
      "utf8",
    );

/*
  Preserve the line-ending style already used by the CSV.
  This prevents CRLF and LF rows from being mixed.
*/

  const lineEnding =
    existingCsvText.includes("\r\n")
      ? "\r\n"
      : "\n";
  
  const fileEndsWithLineBreak =
    existingCsvText.endsWith("\n") ||
    existingCsvText.endsWith("\r");
  
  const rowPrefix =
    existingCsvText.length === 0 ||
    fileEndsWithLineBreak
      ? ""
      : lineEnding;
  
  await appendFile(
    FOREST_PATCH_CSV_PATH,
    `${rowPrefix}${csvRow}${lineEnding}`,
    "utf8",
  );

  await ensurePatchEvidenceFolder(normalizedPatch.Patch_ID);

  console.log(
    "Forest patch appended to CSV:",
    {
      path:
        FOREST_PATCH_CSV_PATH,

      patch:
        normalizedPatch,
    },
  );

  return {
    ...normalizedPatch,
  };
}

/* =========================================================
   UPDATE PATCH VALIDATION
   ========================================================= */

export function validatePatchUpdateForCsv(
  patch: ForestPatchRecord,

  existingPatches:
    readonly ForestPatchRecord[],
):
  PatchValidationResult {
  const patchId =
    patch.Patch_ID.trim();

  const patchName =
    patch.Patch_Name.trim();

  const existingPatch =
    existingPatches.find(
      (record) =>
        record.Patch_ID.trim() ===
        patchId,
    );

  if (!existingPatch) {
    return {
      isValid: false,
      field: "Patch_ID",
      message:
        `Patch "${patchId}" was not found.`,
    };
  }

  if (!patchName) {
    return {
      isValid: false,
      field: "Patch_Name",
      message:
        "Enter a patch name.",
    };
  }

  const normalizedPatchName =
    normalizePatchName(
      patchName,
    );

  const duplicateName =
    existingPatches.some(
      (record) =>
        record.Patch_ID.trim() !==
          patchId &&
        normalizePatchName(
          record.Patch_Name,
        ) ===
          normalizedPatchName,
    );

  if (duplicateName) {
    return {
      isValid: false,
      field: "Patch_Name",
      message:
        "A patch with this name already exists.",
    };
  }

  return {
    isValid: true,
  };
}

/* =========================================================
   REWRITE PATCH CSV
   ========================================================= */

export async function writeForestPatchRecords(
  patches:
    readonly ForestPatchRecord[],
): Promise<void> {
  await ensureForestPatchCsv();

  const existingCsvText =
    await readFile(
      FOREST_PATCH_CSV_PATH,
      "utf8",
    );

  const lineEnding =
    existingCsvText.includes("\r\n")
      ? "\r\n"
      : "\n";

  const headerRow =
    FOREST_PATCH_HEADERS.join(
      ",",
    );

  const dataRows =
    patches.map(
      createForestPatchCsvRow,
    );

  const csvText =
    [
      headerRow,
      ...dataRows,
    ].join(
      lineEnding,
    ) +
    lineEnding;

  await writeFile(
    FOREST_PATCH_CSV_PATH,
    csvText,
    "utf8",
  );
}

/* =========================================================
   REPLACE PATCH
   ========================================================= */

export async function replaceForestPatchInCsv(
  patch: ForestPatchRecord,
): Promise<ForestPatchRecord> {
  await ensureForestPatchCsv();

  const existingPatches =
    await readForestPatchCsv();

  const validation =
    validatePatchUpdateForCsv(
      patch,
      existingPatches,
    );

  if (!validation.isValid) {
    throw new Error(
      validation.message ??
      "The patch could not be updated.",
    );
  }

  const patchIndex =
    existingPatches.findIndex(
      (record) =>
        record.Patch_ID.trim() ===
        patch.Patch_ID.trim(),
    );

  if (patchIndex < 0) {
    throw new Error(
      `Patch "${patch.Patch_ID}" was not found.`,
    );
  }

  const existingPatch =
    existingPatches[
      patchIndex
    ];

  const normalizedPatch:
    ForestPatchRecord = {
    ...existingPatch,

    /*
      Identity, placement, counts and creation date remain
      server-controlled and unchanged during patch editing.
    */

    Patch_Name:
      patch.Patch_Name
        .trim()
        .replace(/\s+/g, " "),

    Patch_Style:
      patch.Patch_Style
        .trim()
        .padStart(2, "0"),

    Patch_Description:
      patch.Patch_Description.trim(),

    Last_Updated:
      patch.Last_Updated.trim(),
  };

  existingPatches[
    patchIndex
  ] = normalizedPatch;

  await writeForestPatchRecords(
    existingPatches,
  );

  console.log(
    "Forest patch replaced in CSV:",
    {
      path:
        FOREST_PATCH_CSV_PATH,

      patch:
        normalizedPatch,
    },
  );

  return {
    ...normalizedPatch,
  };
}


/* =========================================================
   DELETE PATCH AND COMPACT LAYOUT
   ========================================================= */

const TREES_CSV_PATH = path.join(
  process.cwd(),
  "storage",
  "Trees.csv",
);

const TREE_HEADERS = [
  "Tree_ID",
  "Patch_ID",
  "Tree_Name",
  "Tree_Description",
  "Date_Planted",
  "Date_Sprouted",
  "Growth_Stage",
  "Display_Slot",
  "Evidence_Path",
] as const;

function serializeRecords(
  headers: readonly string[],
  records: readonly object[],
  lineEnding: string,
): string {
  const normalized = records.map((record) => {
    const source = record as Record<string, unknown>;
    return Object.fromEntries(headers.map((header) => [header, source[header] ?? ""]));
  });

  return Papa.unparse(normalized, {
    columns: [...headers],
    newline: lineEnding,
  }) + lineEnding;
}

export interface DeletePatchResult {
  patchId: string;
  patches: ForestPatchRecord[];
  deletedTreeIds: string[];
}

export async function deleteForestPatchFromCsv(
  patchIdInput: string,
): Promise<DeletePatchResult> {
  const patchId = patchIdInput.trim();
  const patches = await readForestPatchCsv();
  const patchExists = patches.some((patch) => patch.Patch_ID === patchId);

  if (!patchExists) {
    throw new Error(`Patch "${patchId}" was not found.`);
  }

  const treeCsvText = await readFile(TREES_CSV_PATH, "utf8").catch(() => "");
  const parsedTrees = Papa.parse<Record<string, string>>(
    treeCsvText.replace(/^\uFEFF/, ""),
    { header: true, skipEmptyLines: "greedy", transformHeader: (header) => header.trim() },
  );

  const trees: TreeRecord[] = parsedTrees.data
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

  const deletedTreeIds = trees
    .filter((tree) => tree.Patch_ID === patchId)
    .map((tree) => tree.Tree_ID);

  const remainingTrees = trees.filter((tree) => tree.Patch_ID !== patchId);
  const orderedRemainingPatches = patches
    .filter((patch) => patch.Patch_ID !== patchId)
    .sort((a, b) => a.Patch_Order - b.Patch_Order);
  const coordinates = generateHexSpiral(orderedRemainingPatches.length);
  const currentDate = new Date().toISOString().slice(0, 10);

  const compactedPatches = orderedRemainingPatches.map((patch, index) => ({
    ...patch,
    Patch_Order: index + 1,
    Hex_Q: coordinates[index].q,
    Hex_R: coordinates[index].r,
    Last_Updated: currentDate,
  }));

  const existingPatchText = await readFile(FOREST_PATCH_CSV_PATH, "utf8").catch(() => "");
  const patchLineEnding = existingPatchText.includes("\r\n") ? "\r\n" : "\n";
  const treeLineEnding = treeCsvText.includes("\r\n") ? "\r\n" : "\n";
  const patchTempPath = `${FOREST_PATCH_CSV_PATH}.tmp`;
  const treeTempPath = `${TREES_CSV_PATH}.tmp`;

  await Promise.all([
    writeFile(
      patchTempPath,
      serializeRecords(FOREST_PATCH_HEADERS, compactedPatches, patchLineEnding),
      "utf8",
    ),
    writeFile(
      treeTempPath,
      serializeRecords(TREE_HEADERS, remainingTrees, treeLineEnding),
      "utf8",
    ),
  ]);

  await rename(patchTempPath, FOREST_PATCH_CSV_PATH);
  await rename(treeTempPath, TREES_CSV_PATH);
  await deletePatchEvidenceFolder(patchId);

  return {
    patchId,
    patches: compactedPatches,
    deletedTreeIds,
  };
}
