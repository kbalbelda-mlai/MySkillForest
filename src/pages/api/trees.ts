import type { APIRoute } from "astro";

import {
  deleteTreeInCsv,
  editTreeInCsv,
  plantTreeInCsv,
  validatePlantTreeInput,
} from "../../scripts/treeCsvWriter";

export const prerender = false;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function mapError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "The tree operation failed.";
  const normalized = message.toLocaleLowerCase();
  const duplicate = normalized.includes("tree with this name already exists");
  const missing = normalized.includes("was not found");
  const full = normalized.includes("already contains 20 trees");
  const field = duplicate ? "Tree_Name" : full ? "Display_Slot" : missing ? "Tree_ID" : "Request";
  return jsonResponse(
    { success: false, field, message },
    duplicate || full ? 409 : missing ? 404 : 500,
  );
}

export const POST: APIRoute = async ({ request }) => {
  const body = await readBody(request);
  if (!body) return jsonResponse({ success: false, field: "Request", message: "The request body must contain valid JSON." }, 400);

  const input = {
    Patch_ID: readString(body.patchId),
    Tree_Name: readString(body.treeName),
    Tree_Description: readString(body.treeDescription),
    Date_Planted: readString(body.datePlanted),
  };

  const validation = validatePlantTreeInput(input);
  if (!validation.isValid) return jsonResponse({ success: false, field: validation.field, message: validation.message }, 400);

  try {
    const result = await plantTreeInCsv(input);
    return jsonResponse({ success: true, ...result }, 201);
  } catch (error) {
    return mapError(error);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  const body = await readBody(request);
  if (!body) return jsonResponse({ success: false, field: "Request", message: "The request body must contain valid JSON." }, 400);

  const input = {
    Tree_ID: readString(body.treeId),
    Patch_ID: readString(body.patchId),
    Tree_Name: readString(body.treeName),
    Tree_Description: readString(body.treeDescription),
    Date_Planted: readString(body.datePlanted),
  };

  if (!input.Tree_ID) return jsonResponse({ success: false, field: "Tree_ID", message: "A tree ID is required." }, 400);
  const validation = validatePlantTreeInput(input);
  if (!validation.isValid) return jsonResponse({ success: false, field: validation.field, message: validation.message }, 400);

  try {
    const result = await editTreeInCsv(input);
    return jsonResponse({ success: true, ...result }, 200);
  } catch (error) {
    return mapError(error);
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const body = await readBody(request);
  const treeId = readString(body?.treeId);
  if (!treeId) return jsonResponse({ success: false, field: "Tree_ID", message: "A tree ID is required." }, 400);

  try {
    const result = await deleteTreeInCsv(treeId);
    return jsonResponse({ success: true, ...result }, 200);
  } catch (error) {
    return mapError(error);
  }
};
