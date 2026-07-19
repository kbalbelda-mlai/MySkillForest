import type {
  APIRoute,
} from "astro";

import {
  plantTreeInCsv,
  validatePlantTreeInput,
} from "../../scripts/treeCsvWriter";

export const prerender = false;

interface PlantTreeRequestBody {
  patchId?: unknown;
  treeName?: unknown;
  treeDescription?: unknown;
  datePlanted?: unknown;
}

function jsonResponse(
  body: unknown,
  status: number,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control":
          "no-store",
      },
    },
  );
}

function readString(
  value: unknown,
): string {
  return typeof value ===
    "string"
    ? value
    : "";
}

export const POST:
  APIRoute = async ({
    request,
  }) => {
    let body:
      PlantTreeRequestBody;

    try {
      body =
        await request.json() as
          PlantTreeRequestBody;
    } catch {
      return jsonResponse(
        {
          success: false,
          field: "Request",
          message:
            "The request body must contain valid JSON.",
        },
        400,
      );
    }

    const input = {
      Patch_ID:
        readString(
          body.patchId,
        ),
      Tree_Name:
        readString(
          body.treeName,
        ),
      Tree_Description:
        readString(
          body.treeDescription,
        ),
      Date_Planted:
        readString(
          body.datePlanted,
        ),
    };

    const validation =
      validatePlantTreeInput(
        input,
      );

    if (!validation.isValid) {
      return jsonResponse(
        {
          success: false,
          field:
            validation.field,
          message:
            validation.message,
        },
        400,
      );
    }

    try {
      const result =
        await plantTreeInCsv(
          input,
        );

      return jsonResponse(
        {
          success: true,
          tree:
            result.tree,
          patch:
            result.patch,
        },
        201,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The tree could not be planted.";

      const isFull =
        message.includes(
          "already contains 20 trees",
        );
      
      const missingPatch =
        message.includes(
          "was not found",
        );
      
      const duplicateName =
        message.includes(
          "tree with this name already exists",
        );
      
      return jsonResponse(
        {
          success: false,
      
          field:
            duplicateName
              ? "Tree_Name"
              : isFull
                ? "Display_Slot"
                : missingPatch
                  ? "Patch_ID"
                  : "Request",
      
          message,
        },
      
        duplicateName ||
        isFull
          ? 409
          : missingPatch
            ? 404
            : 500,
      );

      return jsonResponse(
        {
          success: false,
          field:
            isFull
              ? "Display_Slot"
              : missingPatch
                ? "Patch_ID"
                : "Request",
          message,
        },
        isFull
          ? 409
          : missingPatch
            ? 404
            : 500,
      );
    }
  };
