import { test } from "node:test";
import assert from "node:assert/strict";
import { gridTileCenters } from "../recaptcha-grid.js";

test("france-tls recaptcha grid: maps one-based tile numbers to cell centers", () => {
  assert.deepEqual(
    gridTileCenters({
      imageBox: { x: 100, y: 200, width: 300, height: 300 },
      rows: 3,
      columns: 3,
      tiles: [1, 5, 9],
    }),
    [
      { x: 150, y: 250 },
      { x: 250, y: 350 },
      { x: 350, y: 450 },
    ],
  );
});

test("france-tls recaptcha grid: rejects tile numbers outside the grid", () => {
  assert.throws(
    () =>
      gridTileCenters({
        imageBox: { x: 0, y: 0, width: 300, height: 300 },
        rows: 3,
        columns: 3,
        tiles: [10],
      }),
    /outside 3x3 grid/,
  );
});
