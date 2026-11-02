import { test } from "node:test";
import assert from "node:assert/strict";
import { missingPieceRows } from "./monthlyPieces.ts";
import { DEFAULT_PACKAGES, packageSummary, slugifyPackage } from "./packages.ts";

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
  const rows = missingPieceRows(clients, pieces, 11, DEFAULT_PACKAGES);
  assert.deepEqual(
    rows.filter((r) => r.client_id === "a").map((r) => r.code),
    ["11.v.2", "11.v.4", "11.v.5", "11.v.6"]
  );
  assert.deepEqual(
    rows.filter((r) => r.client_id === "d").map((r) => r.code),
    ["11.f.1", "11.f.2", "11.f.3", "11.f.4"]
  );
  assert.equal(rows.filter((r) => r.client_id === "b" || r.client_id === "c").length, 0);
  assert.equal(missingPieceRows(clients, [...pieces, ...rows], 11, DEFAULT_PACKAGES).length, 0);
});

test("missingPieceRows usa la cuota de un paquete personalizado y salta valores desconocidos", () => {
  const packages = { ...DEFAULT_PACKAGES, premium: { value: "premium", label: "Premium", reels: 2, fotos: 1, carruseles: 3, pautaPerWeek: 2 } };
  const rows = missingPieceRows(
    [
      { id: "a", package: "premium", paused: false },
      { id: "b", package: "borrado", paused: false },
    ],
    [],
    12,
    packages
  );
  assert.deepEqual(rows.map((r) => r.code), ["12.v.1", "12.v.2", "12.f.1"]);
  assert.equal(rows.some((r) => r.client_id === "b"), false);
});

test("slugifyPackage quita acentos, evita choques y nunca queda vacío", () => {
  assert.equal(slugifyPackage("Paquete Élite 2x", []), "paquete_elite_2x");
  assert.equal(slugifyPackage("Paquete #1", ["paquete_1"]), "paquete_1_2");
  assert.equal(slugifyPackage("???", []), "paquete");
});

test("packageSummary lista solo lo que incluye", () => {
  assert.equal(packageSummary(DEFAULT_PACKAGES["1"]), "4 reels · 4 fotos");
  assert.equal(packageSummary({ ...DEFAULT_PACKAGES.solamente_pauta, pautaPerWeek: 1 }), "1 post de pauta/sem");
  assert.equal(packageSummary(DEFAULT_PACKAGES.solamente_pauta), "Sin contenido incluido");
});
