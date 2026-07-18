import {
  access,
  appendFile,
  readFile,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

import type {
  ForestPatchRecord,
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
    "src",
    "data",
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

async function writeForestPatchRecords(
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
