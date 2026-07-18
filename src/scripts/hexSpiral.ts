/* =========================================================
   HEX SPIRAL TYPES
   ========================================================= */

export interface HexCoordinate {
  q: number;
  r: number;
}

/* =========================================================
   AXIAL HEX DIRECTIONS

   The forest uses axial coordinates:
   - q controls the horizontal direction
   - r controls the diagonal/vertical direction
   ========================================================= */

const HEX_DIRECTIONS: readonly HexCoordinate[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

/* =========================================================
   COORDINATE HELPERS
   ========================================================= */

function addHexCoordinates(
  first: HexCoordinate,
  second: HexCoordinate,
): HexCoordinate {
  return {
    q: first.q + second.q,
    r: first.r + second.r,
  };
}

function multiplyHexCoordinate(
  coordinate: HexCoordinate,
  amount: number,
): HexCoordinate {
  return {
    q: coordinate.q * amount,
    r: coordinate.r * amount,
  };
}

function createCoordinateKey(
  coordinate: HexCoordinate,
): string {
  return `${coordinate.q},${coordinate.r}`;
}

/* =========================================================
   GENERATE ONE HEX RING

   Radius 0 contains only the center patch.

   Radius 1 contains 6 coordinates.
   Radius 2 contains 12 coordinates.
   Radius 3 contains 18 coordinates.
   ========================================================= */

export function generateHexRing(
  radius: number,
): HexCoordinate[] {
  if (!Number.isInteger(radius) || radius < 0) {
    throw new Error(
      "Hex ring radius must be a non-negative integer.",
    );
  }

  if (radius === 0) {
    return [
      {
        q: 0,
        r: 0,
      },
    ];
  }

  const coordinates: HexCoordinate[] = [];

  /*
    Start on the upper-right edge of the ring, then walk
    around all six sides.
  */

  let currentCoordinate =
    multiplyHexCoordinate(
      HEX_DIRECTIONS[4],
      radius,
    );

  for (
    let directionIndex = 0;
    directionIndex < 6;
    directionIndex += 1
  ) {
    const direction =
      HEX_DIRECTIONS[directionIndex];

    for (
      let step = 0;
      step < radius;
      step += 1
    ) {
      coordinates.push({
        ...currentCoordinate,
      });

      currentCoordinate =
        addHexCoordinates(
          currentCoordinate,
          direction,
        );
    }
  }

  return coordinates;
}

/* =========================================================
   GENERATE SPIRAL COORDINATES

   The returned array always begins with:
   Patch 1 -> q = 0, r = 0

   The remaining patches fill outward ring by ring.
   ========================================================= */

export function generateHexSpiral(
  coordinateCount: number,
): HexCoordinate[] {
  if (
    !Number.isInteger(coordinateCount) ||
    coordinateCount < 0
  ) {
    throw new Error(
      "Hex spiral coordinate count must be a non-negative integer.",
    );
  }

  if (coordinateCount === 0) {
    return [];
  }

  const coordinates: HexCoordinate[] = [
    {
      q: 0,
      r: 0,
    },
  ];

  let radius = 1;

  while (
    coordinates.length <
    coordinateCount
  ) {
    const ringCoordinates =
      generateHexRing(radius);

    for (
      const coordinate of
      ringCoordinates
    ) {
      coordinates.push(coordinate);

      if (
        coordinates.length >=
        coordinateCount
      ) {
        break;
      }
    }

    radius += 1;
  }

  return coordinates;
}

/* =========================================================
   GET COORDINATE BY PATCH ORDER

   Patch order is one-based:
   - Order 1 returns the center
   - Order 2 returns the first position in ring 1
   ========================================================= */

export function getHexCoordinateForOrder(
  patchOrder: number,
): HexCoordinate {
  if (
    !Number.isInteger(patchOrder) ||
    patchOrder < 1
  ) {
    throw new Error(
      "Patch order must be a positive integer.",
    );
  }

  const coordinates =
    generateHexSpiral(patchOrder);

  return coordinates[
    patchOrder - 1
  ];
}

/* =========================================================
   FIND NEXT AVAILABLE COORDINATE

   Existing coordinates may contain gaps or manually assigned
   positions. This function returns the first unused coordinate
   in spiral order.
   ========================================================= */

export function findNextAvailableHexCoordinate(
  existingCoordinates:
    readonly HexCoordinate[],
): HexCoordinate {
  const occupiedCoordinates =
    new Set(
      existingCoordinates.map(
        createCoordinateKey,
      ),
    );

  let candidateCount =
    Math.max(
      existingCoordinates.length + 1,
      1,
    );

  while (true) {
    const candidates =
      generateHexSpiral(
        candidateCount,
      );

    for (
      const candidate of candidates
    ) {
      const candidateKey =
        createCoordinateKey(
          candidate,
        );

      if (
        !occupiedCoordinates.has(
          candidateKey,
        )
      ) {
        console.log(
          "Next available hex coordinate found:",
          candidate,
        );

        return candidate;
      }
    }

    candidateCount += 6;
  }
}