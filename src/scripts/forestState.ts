import type {
  ForestPatchRecord,
  TreeRecord,
} from "./loadForestData";

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
    | "patch-deleted"
    | "tree-added"
    | "tree-updated"
    | "tree-deleted";
  snapshot: ForestStateSnapshot;
}

export interface AddForestPatchInput {
  Patch_ID: string;
  Patch_Name: string;
  Patch_Style: number;
  Patch_Order: number;
  Hex_Q: number;
  Hex_R: number;
  Patch_Description: string;
}

export interface UpdateForestPatchInput {
  Patch_ID: string;
  Patch_Name: string;
  Patch_Style: number;
  Patch_Description: string;
}

export interface AddForestTreeInput {
  tree: TreeRecord;
  patch: ForestPatchRecord;
}

let forestPatches: ForestPatchRecord[] = [];
let forestTrees: TreeRecord[] = [];
let hasBeenInitialized = false;

const clonePatch = (patch: ForestPatchRecord): ForestPatchRecord => ({ ...patch });
const cloneTree = (tree: TreeRecord): TreeRecord => ({ ...tree });
const getCurrentDate = (): string => new Date().toISOString().slice(0, 10);

function calculateStatistics(): ForestStatistics {
  return {
    patchCount: forestPatches.length,
    saplingCount: forestTrees.filter((tree) => tree.Growth_Stage === "SAPLING").length,
    treeCount: forestTrees.filter((tree) => tree.Growth_Stage === "TREE").length,
  };
}

export function getForestState(): ForestStateSnapshot {
  return {
    patches: forestPatches.map(clonePatch),
    trees: forestTrees.map(cloneTree),
    statistics: calculateStatistics(),
  };
}

function dispatchForestStateChanged(
  reason: ForestStateChangedDetail["reason"],
): void {
  window.dispatchEvent(
    new CustomEvent<ForestStateChangedDetail>(
      "forest:state-changed",
      {
        detail: {
          reason,
          snapshot: getForestState(),
        },
      },
    ),
  );
}

export function initializeForestState(
  patches: readonly ForestPatchRecord[],
  trees: readonly TreeRecord[],
): void {
  forestPatches = patches.map(clonePatch);
  forestTrees = trees.map(cloneTree);
  hasBeenInitialized = true;
  dispatchForestStateChanged("initialized");
}

export function isForestStateInitialized(): boolean {
  return hasBeenInitialized;
}

export function getForestPatchById(
  patchId: string,
): ForestPatchRecord | undefined {
  const patch = forestPatches.find(
    (record) => record.Patch_ID === patchId.trim(),
  );
  return patch ? clonePatch(patch) : undefined;
}

export function getForestTreeById(
  treeId: string,
): TreeRecord | undefined {
  const tree = forestTrees.find(
    (record) => record.Tree_ID === treeId.trim(),
  );
  return tree ? cloneTree(tree) : undefined;
}

export function getForestTreesByPatchId(
  patchId: string,
): TreeRecord[] {
  return forestTrees
    .filter((tree) => tree.Patch_ID === patchId.trim())
    .map(cloneTree);
}

export function addForestPatch(
  input: AddForestPatchInput,
): ForestPatchRecord {
  const patchId = input.Patch_ID.trim();
  const patchName = input.Patch_Name.trim().replace(/\s+/g, " ");

  if (!patchId || !patchName) {
    throw new Error("Patch ID and name are required.");
  }

  if (forestPatches.some((patch) => patch.Patch_ID === patchId)) {
    throw new Error(`Patch ID "${patchId}" already exists.`);
  }

  const currentDate = getCurrentDate();
  const newPatch: ForestPatchRecord = {
    Patch_ID: patchId,
    Patch_Name: patchName,
    Patch_Style: String(input.Patch_Style).padStart(2, "0"),
    Patch_Order: input.Patch_Order,
    Hex_Q: input.Hex_Q,
    Hex_R: input.Hex_R,
    Saplings_Planted: 0,
    Trees_Grown: 0,
    Patch_Description: input.Patch_Description.trim(),
    Date_Created: currentDate,
    Last_Updated: currentDate,
  };

  forestPatches.push(newPatch);
  forestPatches.sort((a, b) => a.Patch_Order - b.Patch_Order);
  dispatchForestStateChanged("patch-added");
  return clonePatch(newPatch);
}

export function updateForestPatch(
  input: UpdateForestPatchInput,
): ForestPatchRecord {
  const index = forestPatches.findIndex(
    (patch) => patch.Patch_ID === input.Patch_ID.trim(),
  );

  if (index < 0) {
    throw new Error(`Patch "${input.Patch_ID}" was not found.`);
  }

  const updatedPatch: ForestPatchRecord = {
    ...forestPatches[index],
    Patch_Name: input.Patch_Name.trim().replace(/\s+/g, " "),
    Patch_Style: String(input.Patch_Style).padStart(2, "0"),
    Patch_Description: input.Patch_Description.trim(),
    Last_Updated: getCurrentDate(),
  };

  forestPatches[index] = updatedPatch;
  dispatchForestStateChanged("patch-updated");
  window.dispatchEvent(new CustomEvent("forest:patch-updated", {
    detail: { patch: clonePatch(updatedPatch) },
  }));
  return clonePatch(updatedPatch);
}

export function addForestTree(
  input: AddForestTreeInput,
): TreeRecord {
  if (forestTrees.some((tree) => tree.Tree_ID === input.tree.Tree_ID)) {
    throw new Error(`Tree ID "${input.tree.Tree_ID}" already exists.`);
  }

  forestTrees.push(cloneTree(input.tree));
  forestTrees.sort((a, b) =>
    a.Patch_ID.localeCompare(b.Patch_ID, undefined, { numeric: true }) ||
    a.Display_Slot - b.Display_Slot,
  );

  const patchIndex = forestPatches.findIndex(
    (patch) => patch.Patch_ID === input.patch.Patch_ID,
  );

  if (patchIndex >= 0) {
    forestPatches[patchIndex] = clonePatch(input.patch);
  }

  dispatchForestStateChanged("tree-added");
  window.dispatchEvent(new CustomEvent("forest:tree-added", {
    detail: {
      tree: cloneTree(input.tree),
      patch: clonePatch(input.patch),
    },
  }));
  return cloneTree(input.tree);
}

export function updateForestTree(
  tree: TreeRecord,
): TreeRecord {
  const index = forestTrees.findIndex(
    (record) => record.Tree_ID === tree.Tree_ID,
  );

  if (index < 0) {
    throw new Error(`Tree "${tree.Tree_ID}" was not found.`);
  }

  forestTrees[index] = cloneTree(tree);
  dispatchForestStateChanged("tree-updated");
  window.dispatchEvent(new CustomEvent("forest:tree-updated", {
    detail: { tree: cloneTree(tree) },
  }));
  return cloneTree(tree);
}

export function deleteForestTree(
  treeId: string,
  patch: ForestPatchRecord,
): void {
  forestTrees = forestTrees.filter(
    (tree) => tree.Tree_ID !== treeId.trim(),
  );

  const patchIndex = forestPatches.findIndex(
    (record) => record.Patch_ID === patch.Patch_ID,
  );

  if (patchIndex >= 0) {
    forestPatches[patchIndex] = clonePatch(patch);
  }

  dispatchForestStateChanged("tree-deleted");
  window.dispatchEvent(new CustomEvent("forest:tree-deleted", {
    detail: { treeId: treeId.trim(), patch: clonePatch(patch) },
  }));
}

export function deleteForestPatch(
  patchId: string,
  patches: readonly ForestPatchRecord[],
  deletedTreeIds: readonly string[],
): void {
  forestPatches = patches.map(clonePatch);
  forestTrees = forestTrees.filter(
    (tree) => tree.Patch_ID !== patchId.trim(),
  );

  dispatchForestStateChanged("patch-deleted");
  window.dispatchEvent(new CustomEvent("forest:patch-deleted", {
    detail: {
      patchId: patchId.trim(),
      patches: forestPatches.map(clonePatch),
      deletedTreeIds: [...deletedTreeIds],
    },
  }));
}
