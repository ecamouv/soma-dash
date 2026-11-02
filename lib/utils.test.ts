import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGrid, byDateNullsLast, iso, isAheadOf, nextCodeNumbers, weeksInMonth } from "./utils.ts";

test("nextCodeNumbers rellena huecos y respeta mes y tipo", () => {
  const codes = ["9.v.1", "9.v.3", "9.f.2", "10.v.2"];
  assert.deepEqual(nextCodeNumbers(codes, "v", 9, 3), [2, 4, 5]);
  assert.deepEqual(nextCodeNumbers(codes, "f", 9, 2), [1, 3]);
  assert.deepEqual(nextCodeNumbers([], "v", 1, 0), []);
});

test("isAheadOf cubre diciembre -> enero", () => {
  assert.equal(isAheadOf(1, 12), true);
  assert.equal(isAheadOf(11, 10), true);
  assert.equal(isAheadOf(10, 10), false);
  assert.equal(isAheadOf(9, 10), false);
});

test("weeksInMonth topa en 4 semanas", () => {
  assert.equal(weeksInMonth(2026, 1), 4); // febrero 2026: empieza en domingo -> 5 filas, tope 4
  assert.equal(weeksInMonth(2021, 1), 4); // febrero 2021: exactamente 4 filas
});

test("buildGrid empieza en lunes y tiene 42 días", () => {
  const grid = buildGrid(new Date(2026, 9, 15)); // octubre 2026 empieza en jueves
  assert.equal(grid.length, 42);
  assert.equal(iso(grid[0]), "2026-09-28");
  assert.equal(iso(grid[41]), "2026-11-08");
});

test("iso usa la fecha local, no UTC", () => {
  assert.equal(iso(new Date(2026, 9, 22, 23, 30)), "2026-10-22");
});

test("byDateNullsLast deja vacías al final", () => {
  assert.deepEqual(["2026-10-02", null, "2026-10-01"].sort(byDateNullsLast), ["2026-10-01", "2026-10-02", null]);
});
