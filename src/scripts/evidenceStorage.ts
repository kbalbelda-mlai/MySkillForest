import {
  mkdir,
  rm,
} from "node:fs/promises";

import path from "node:path";

const EVIDENCE_ROOT = path.join(
  process.cwd(),
  "public",
  "evidence",
);

function safeSegment(value: string): string {
  const segment = value.trim();

  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new Error("Evidence folder identifiers may only contain letters, numbers, underscores, and hyphens.");
  }

  return segment;
}

function resolveEvidencePath(relativePath: string): string {
  const normalized = relativePath
    .trim()
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");

  if (!normalized.startsWith("evidence/")) {
    throw new Error("Evidence path must be inside the evidence directory.");
  }

  const absolutePath = path.resolve(
    process.cwd(),
    "public",
    normalized,
  );

  const rootWithSeparator = `${path.resolve(EVIDENCE_ROOT)}${path.sep}`;

  if (
    absolutePath !== path.resolve(EVIDENCE_ROOT) &&
    !absolutePath.startsWith(rootWithSeparator)
  ) {
    throw new Error("Evidence path is outside the allowed evidence directory.");
  }

  return absolutePath;
}

export function getPatchEvidenceRelativePath(
  patchId: string,
): string {
  return `evidence/${safeSegment(patchId)}`;
}

export function getTreeEvidenceRelativePath(
  patchId: string,
  treeId: string,
): string {
  return `${getPatchEvidenceRelativePath(patchId)}/${safeSegment(treeId)}`;
}

export async function ensurePatchEvidenceFolder(
  patchId: string,
): Promise<string> {
  const relativePath = getPatchEvidenceRelativePath(patchId);

  await mkdir(
    resolveEvidencePath(relativePath),
    { recursive: true },
  );

  return relativePath;
}

export async function ensureTreeEvidenceFolder(
  patchId: string,
  treeId: string,
): Promise<string> {
  await ensurePatchEvidenceFolder(patchId);

  const relativePath = getTreeEvidenceRelativePath(
    patchId,
    treeId,
  );

  await mkdir(
    resolveEvidencePath(relativePath),
    { recursive: true },
  );

  return relativePath;
}

export async function deleteTreeEvidenceFolder(
  patchId: string,
  treeId: string,
  storedEvidencePath = "",
): Promise<void> {
  const relativePath = storedEvidencePath.trim() ||
    getTreeEvidenceRelativePath(patchId, treeId);

  await rm(
    resolveEvidencePath(relativePath),
    {
      recursive: true,
      force: true,
    },
  );
}

export async function deletePatchEvidenceFolder(
  patchId: string,
): Promise<void> {
  await rm(
    resolveEvidencePath(
      getPatchEvidenceRelativePath(patchId),
    ),
    {
      recursive: true,
      force: true,
    },
  );
}
