import { test } from "node:test";
import assert from "node:assert/strict";
import { missingPieceRows } from "./monthlyPieces.ts";

test("missingPieceRows completa la cuota sin duplicar ni tocar pausados/pauta", () => {
  const clients = [
    { id: "a", package: "6_videos", paused: false },
    { id: "b", package: "1", paused: true },
    { id: "c", package: "solamente_pauta", paused: false },
    { id: "d", package: "1", paused: false },
  ];
  const pieces = [
    { client_id: "a", code: "11.v.1", type: "v" as const },
    { client_id: "a", code: "11.v.3", type: "v" as const },
    { client_id: "d", code: "11.v.1", type: "v" as const },
    { client_id: "d", code: "11.v.2", type: "v" as const },
    { client_id: "d", code: "11.v.3", type: "v" as const },
    { client_id: "d", code: "11.v.4", type: "v" as const },
  ];
  const rows = missingPieceRows(clients, pieces, 11);
  assert.deepEqual(
    rows.filter((r) => r.client_id === "a").map((r) => r.code),
    ["11.v.2", "11.v.4", "11.v.5", "11.v.6"]
  );
  assert.deepEqual(
    rows.filter((r) => r.client_id === "d").map((r) => r.code),
    ["11.f.1", "11.f.2", "11.f.3", "11.f.4"]
  );
  assert.equal(rows.filter((r) => r.client_id === "b" || r.client_id === "c").length, 0);
  assert.equal(missingPieceRows(clients, [...pieces, ...rows], 11).length, 0);
});
