import type {
  ForestPatchRecord,
  TreeRecord,
} from "./loadForestData";

/* =========================================================
   FOREST STATE TYPES
   ========================================================= */

export interface ForestStatistics {
  patchCount: number;
  saplingCount: number;
  treeCount: number;
}

export interface ForestStateSnapshot {
  patches: ForestPatchRecord[];
  trees: TreeRecord[];
  statistics: ForestStatistics;
}

export interface ForestStateChangedDetail {
  reason:
    | "initialized"
    | "patch-added"
    | "patch-updated"
    | "tree-added"
    | "tree-updated";

  snapshot: ForestStateSnapshot;
}

export interface AddForestPatchInput {
  Patch_ID: string;
  Patch_Name: string;

  /*
    The dialog uses numeric values from 1 to 9.
    The stored ForestPatchRecord converts this to "01"–"09".
  */
  Patch_Style: number;

  Patch_Order: number;
  Hex_Q: number;
  Hex_R: number;
  Patch_Description: string;
}

/* =========================================================
   IN-MEMORY STATE

   This state exists only in the browser.

   Refreshing the page restores the original CSV data until
   persistence is added in a later milestone.
   ========================================================= */

let forestPatches:
  ForestPatchRecord[] = [];

let forestTrees:
  TreeRecord[] = [];

let hasBeenInitialized = false;

/* =========================================================
   CLONING HELPERS
   ========================================================= */

function clonePatch(
  patch: ForestPatchRecord,
): ForestPatchRecord {
  return {
    ...patch,
  };
}

function cloneTree(
  tree: TreeRecord,
): TreeRecord {
  return {
    ...tree,
  };
}

/* =========================================================
   DATE HELPERS
   ========================================================= */

function getCurrentDate():
  string {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

/* =========================================================
   STATISTICS
   ========================================================= */

function calculateStatistics():
  ForestStatistics {
  let saplingCount = 0;
  let treeCount = 0;

  for (const tree of forestTrees) {
    if (
      tree.Growth_Stage ===
      "TREE"
    ) {
      treeCount += 1;
    } else {
      saplingCount += 1;
    }
  }

  return {
    patchCount:
      forestPatches.length,

    saplingCount,

    treeCount,
  };
}

/* =========================================================
   STATE SNAPSHOT
   ========================================================= */

export function getForestState():
  ForestStateSnapshot {
  return {
    patches:
      forestPatches.map(
        clonePatch,
      ),

    trees:
      forestTrees.map(
        cloneTree,
      ),

    statistics:
      calculateStatistics(),
  };
}

/* =========================================================
   STATE EVENTS
   ========================================================= */

function dispatchForestStateChanged(
  reason:
    ForestStateChangedDetail["reason"],
) {
  const detail:
    ForestStateChangedDetail = {
      reason,

      snapshot:
        getForestState(),
    };

  window.dispatchEvent(
    new CustomEvent<
      ForestStateChangedDetail
    >(
      "forest:state-changed",
      {
        detail,
      },
    ),
  );

  console.log(
    "Forest state changed:",
    {
      reason,
      snapshot:
        detail.snapshot,
    },
  );
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

export function initializeForestState(
  patches:
    readonly ForestPatchRecord[],

  trees:
    readonly TreeRecord[],
): void {
  forestPatches =
    patches.map(
      clonePatch,
    );

  forestTrees =
    trees.map(
      cloneTree,
    );

  hasBeenInitialized = true;

  dispatchForestStateChanged(
    "initialized",
  );

  console.log(
    "Forest state initialized:",
    {
      patchCount:
        forestPatches.length,

      treeCount:
        forestTrees.length,
    },
  );
}

export function isForestStateInitialized():
  boolean {
  return hasBeenInitialized;
}

/* =========================================================
   PATCH LOOKUP
   ========================================================= */

export function getForestPatchById(
  patchId: string,
):
  | ForestPatchRecord
  | undefined {
  const normalizedPatchId =
    patchId.trim();

  const patch =
    forestPatches.find(
      (record) =>
        record.Patch_ID ===
        normalizedPatchId,
    );

  return patch
    ? clonePatch(patch)
    : undefined;
}

/* =========================================================
   PATCH VALIDATION
   ========================================================= */

function validateNewPatch(
  patch: AddForestPatchInput,
): void {
  const patchId =
    patch.Patch_ID.trim();

  const patchName =
    patch.Patch_Name.trim();

  if (!patchId) {
    throw new Error(
      "Patch ID is required.",
    );
  }

  if (!patchName) {
    throw new Error(
      "Patch name is required.",
    );
  }

  if (
    patchName.length > 50
  ) {
    throw new Error(
      "Patch names cannot exceed 50 characters.",
    );
  }

  if (
    patch.Patch_Description.trim()
      .length > 250
  ) {
    throw new Error(
      "Patch descriptions cannot exceed 250 characters.",
    );
  }

  if (
    forestPatches.some(
      (existingPatch) =>
        existingPatch.Patch_ID ===
        patchId,
    )
  ) {
    throw new Error(
      `Patch ID "${patchId}" already exists.`,
    );
  }

  if (
    forestPatches.some(
      (existingPatch) =>
        existingPatch.Patch_Order ===
        patch.Patch_Order,
    )
  ) {
    throw new Error(
      `Patch order ${patch.Patch_Order} is already assigned.`,
    );
  }

  if (
    forestPatches.some(
      (existingPatch) =>
        existingPatch.Hex_Q ===
          patch.Hex_Q &&
        existingPatch.Hex_R ===
          patch.Hex_R,
    )
  ) {
    throw new Error(
      `Hex coordinate (${patch.Hex_Q}, ${patch.Hex_R}) is already occupied.`,
    );
  }

  if (
    !Number.isInteger(
      patch.Patch_Style,
    ) ||
    patch.Patch_Style < 1 ||
    patch.Patch_Style > 9
  ) {
    throw new Error(
      "Patch style must be an integer from 1 to 9.",
    );
  }

  if (
    !Number.isInteger(
      patch.Patch_Order,
    ) ||
    patch.Patch_Order < 1
  ) {
    throw new Error(
      "Patch order must be a positive integer.",
    );
  }

  if (
    !Number.isInteger(
      patch.Hex_Q,
    ) ||
    !Number.isInteger(
      patch.Hex_R,
    )
  ) {
    throw new Error(
      "Hex coordinates must be integers.",
    );
  }
}

/* =========================================================
   ADD PATCH
   ========================================================= */

export function addForestPatch(
  input: AddForestPatchInput,
): ForestPatchRecord {
  validateNewPatch(
    input,
  );

  const currentDate =
    getCurrentDate();

  const newPatch:
    ForestPatchRecord = {
      Patch_ID:
        input.Patch_ID.trim(),

      Patch_Name:
        input.Patch_Name.trim(),

      Patch_Style:
        String(
          input.Patch_Style,
        ).padStart(2, "0"),

      Patch_Order:
        input.Patch_Order,

      Hex_Q:
        input.Hex_Q,

      Hex_R:
        input.Hex_R,

      Saplings_Planted: 0,

      Trees_Grown: 0,

      Patch_Description:
        input.Patch_Description.trim(),

      Date_Created:
        currentDate,

      Last_Updated:
        currentDate,
    };

  forestPatches.push(
    newPatch,
  );

  forestPatches.sort(
    (
      firstPatch,
      secondPatch,
    ) =>
      firstPatch.Patch_Order -
      secondPatch.Patch_Order,
  );

  dispatchForestStateChanged(
    "patch-added",
  );

  console.log(
    "Forest patch added to temporary state:",
    newPatch,
  );

  return clonePatch(
    newPatch,
  );
}