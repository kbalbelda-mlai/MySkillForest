import type {
  APIRoute,
} from "astro";

import {
  appendForestPatchToCsv,
  readForestPatchCsv,
  validatePatchForCsv,
} from "../../scripts/csvWriter";

import type {
  ForestPatchRecord,
} from "../../scripts/loadForestData";

export const prerender = false;

/* =========================================================
   API TYPES
   ========================================================= */

interface AddPatchRequestBody {
  patch?: unknown;
}

interface ApiErrorResponse {
  success: false;
  message: string;

  field?:
    | "Patch_ID"
    | "Patch_Name"
    | "Patch_Order"
    | "Hex_Coordinate"
    | "Patch_Style"
    | "Patch_Description"
    | "Request";
}

interface ApiSuccessResponse {
  success: true;
  patch: ForestPatchRecord;
}

/* =========================================================
   RESPONSE HELPERS
   ========================================================= */

function jsonResponse(
  body:
    | ApiSuccessResponse
    | ApiErrorResponse,

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

function errorResponse(
  message: string,

  status = 400,

  field?:
    ApiErrorResponse["field"],
): Response {
  return jsonResponse(
    {
      success: false,
      message,
      field,
    },
    status,
  );
}

/* =========================================================
   TYPE HELPERS
   ========================================================= */

function isPlainObject(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readString(
  value: unknown,
): string | null {
  return typeof value === "string"
    ? value
    : null;
}

function readInteger(
  value: unknown,
): number | null {
  if (
    typeof value === "number" &&
    Number.isInteger(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsedValue =
      Number(value);

    return Number.isInteger(
      parsedValue,
    )
      ? parsedValue
      : null;
  }

  return null;
}

/* =========================================================
   REQUEST PARSING
   ========================================================= */

function parsePatchRecord(
  value: unknown,
):
  | {
      success: true;
      patch: ForestPatchRecord;
    }
  | {
      success: false;
      message: string;
      field:
        ApiErrorResponse["field"];
    } {
  if (!isPlainObject(value)) {
    return {
      success: false,
      message:
        "A valid patch record is required.",
      field: "Request",
    };
  }

  const patchId =
    readString(
      value.Patch_ID,
    )?.trim() ?? "";

  const patchName =
    readString(
      value.Patch_Name,
    )?.trim() ?? "";

  const patchStyleRaw =
    readString(
      value.Patch_Style,
    ) ??
    (
      typeof value.Patch_Style ===
      "number"
        ? String(
            value.Patch_Style,
          )
        : ""
    );

  const patchOrder =
    readInteger(
      value.Patch_Order,
    );

  const hexQ =
    readInteger(
      value.Hex_Q,
    );

  const hexR =
    readInteger(
      value.Hex_R,
    );

  const saplingsPlanted =
    readInteger(
      value.Saplings_Planted,
    );

  const treesGrown =
    readInteger(
      value.Trees_Grown,
    );

  const patchDescription =
    readString(
      value.Patch_Description,
    )?.trim() ?? "";

  const dateCreated =
    readString(
      value.Date_Created,
    )?.trim() ?? "";

  const lastUpdated =
    readString(
      value.Last_Updated,
    )?.trim() ?? "";

  if (!patchId) {
    return {
      success: false,
      message:
        "Patch ID is required.",
      field: "Patch_ID",
    };
  }

  if (!patchName) {
    return {
      success: false,
      message:
        "Enter a patch name.",
      field: "Patch_Name",
    };
  }

  if (
    patchName.length > 50
  ) {
    return {
      success: false,
      message:
        "Patch names cannot exceed 50 characters.",
      field: "Patch_Name",
    };
  }

  if (
    patchDescription.length > 250
  ) {
    return {
      success: false,
      message:
        "Patch descriptions cannot exceed 250 characters.",
      field:
        "Patch_Description",
    };
  }

  const patchStyleNumber =
    Number(
      patchStyleRaw,
    );

  if (
    !Number.isInteger(
      patchStyleNumber,
    ) ||
    patchStyleNumber < 1 ||
    patchStyleNumber > 9
  ) {
    return {
      success: false,
      message:
        "Choose a valid patch style.",
      field: "Patch_Style",
    };
  }

  if (
    patchOrder === null ||
    patchOrder < 1
  ) {
    return {
      success: false,
      message:
        "Patch order must be a positive integer.",
      field: "Patch_Order",
    };
  }

  if (
    hexQ === null ||
    hexR === null
  ) {
    return {
      success: false,
      message:
        "Hex coordinates must be integers.",
      field:
        "Hex_Coordinate",
    };
  }

  if (
    saplingsPlanted === null ||
    saplingsPlanted < 0
  ) {
    return {
      success: false,
      message:
        "Sapling count must be zero or greater.",
      field: "Request",
    };
  }

  if (
    treesGrown === null ||
    treesGrown < 0
  ) {
    return {
      success: false,
      message:
        "Tree count must be zero or greater.",
      field: "Request",
    };
  }

  if (
    !dateCreated ||
    !lastUpdated
  ) {
    return {
      success: false,
      message:
        "Patch dates are required.",
      field: "Request",
    };
  }

  return {
    success: true,

    patch: {
      Patch_ID:
        patchId,

      Patch_Name:
        patchName,

      Patch_Style:
        String(
          patchStyleNumber,
        ).padStart(2, "0"),

      Patch_Order:
        patchOrder,

      Hex_Q:
        hexQ,

      Hex_R:
        hexR,

      Saplings_Planted:
        saplingsPlanted,

      Trees_Grown:
        treesGrown,

      Patch_Description:
        patchDescription,

      Date_Created:
        dateCreated,

      Last_Updated:
        lastUpdated,
    },
  };
}

/* =========================================================
   POST /api/patches
   ========================================================= */

export const POST:
  APIRoute = async ({
    request,
  }) => {
    let requestBody:
      AddPatchRequestBody;

    try {
      requestBody =
        await request.json() as
          AddPatchRequestBody;
    } catch (error) {
      console.error(
        "Patch API received invalid JSON:",
        error,
      );

      return errorResponse(
        "The request body must contain valid JSON.",
        400,
        "Request",
      );
    }

    const parsedPatch =
      parsePatchRecord(
        requestBody.patch,
      );

    if (!parsedPatch.success) {
      return errorResponse(
        parsedPatch.message,
        400,
        parsedPatch.field,
      );
    }

    try {
      /*
        Validate against the latest CSV contents before writing.
        This catches duplicate names, IDs, orders and coordinates.
      */

      const existingPatches =
        await readForestPatchCsv();

      const validation =
        validatePatchForCsv(
          parsedPatch.patch,
          existingPatches,
        );

      if (!validation.isValid) {
        return errorResponse(
          validation.message ??
          "The patch could not be saved.",

          409,

          validation.field,
        );
      }

      const savedPatch =
        await appendForestPatchToCsv(
          parsedPatch.patch,
        );

      console.log(
        "Patch API saved patch:",
        savedPatch,
      );

      return jsonResponse(
        {
          success: true,
          patch:
            savedPatch,
        },
        201,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The patch could not be saved.";

      console.error(
        "Patch API failed to save patch:",
        error,
      );

      /*
        appendForestPatchToCsv performs its own final validation.
        Duplicate-name errors thrown there should still be
        displayed beneath the Patch Name field.
      */

      const isDuplicateNameError =
        message.toLocaleLowerCase()
          .includes(
            "name already exists",
          ) ||
        message.toLocaleLowerCase()
          .includes(
            "patch with this name",
          );

      return errorResponse(
        message,
        isDuplicateNameError
          ? 409
          : 500,
        isDuplicateNameError
          ? "Patch_Name"
          : "Request",
      );
    }
  };

/* =========================================================
   METHOD FALLBACKS
   ========================================================= */

export const GET:
  APIRoute = async () => {
    try {
      const patches =
        await readForestPatchCsv();

      return new Response(
        JSON.stringify({
          success: true,
          patches,
        }),
        {
          status: 200,

          headers: {
            "Content-Type":
              "application/json; charset=utf-8",

            "Cache-Control":
              "no-store",
          },
        },
      );
    } catch (error) {
      console.error(
        "Patch API failed to read patches:",
        error,
      );

      return errorResponse(
        "The patch records could not be read.",
        500,
        "Request",
      );
    }
  };