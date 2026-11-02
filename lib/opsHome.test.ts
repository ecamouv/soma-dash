import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysISO,
  initialsOf,
  monthProgress,
  pautaProgress,
  revisionGroups,
} from "./opsHome.ts";
import type { ContentPiece } from "@/lib/types";
import type { PautaPost } from "@/lib/pauta";

const piece = (o: Partial<ContentPiece> & { id: string }): ContentPiece =>
  ({ client_id: "a", code: "11.v.1", type: "v", month: 11, status: "por_grabar", due_date: null, ...o }) as ContentPiece;

const TODAY = "2026-10-28";

test("addDaysISO cruza fin de mes y de año", () => {
  assert.equal(addDaysISO("2026-10-28", 7), "2026-11-04");
  assert.equal(addDaysISO("2026-12-30", 3), "2027-01-02");
});

test("revisionGroups agrupa por cliente y ordena por la fecha más cercana", () => {
  const pieces = [
    piece({ id: "1", client_id: "a", status: "revision", due_date: "2026-11-05", client: { id: "a", name: "Alfa" } }),
    piece({ id: "2", client_id: "b", status: "revision", due_date: "2026-10-30", client: { id: "b", name: "Beta" } }),
    piece({ id: "3", client_id: "a", status: "revision", due_date: null, client: { id: "a", name: "Alfa" } }),
    piece({ id: "4", client_id: "a", status: "aprobado", due_date: "2026-10-29" }),
  ];
  const g = revisionGroups(pieces);
  assert.deepEqual(g.map((x) => x.clientName), ["Beta", "Alfa"]);
  assert.deepEqual(g[1].pieces.map((p) => p.id), ["1", "3"]);
});

test("monthProgress cuenta reels y fotos publicados sobre el total del mes del cliente", () => {
  const pieces = [
    piece({ id: "1", type: "v", status: "publicado" }),
    piece({ id: "2", type: "v", status: "revision" }),
    piece({ id: "3", type: "f", status: "publicado" }),
    piece({ id: "4", type: "v", month: 12, status: "publicado" }), // otro mes
    piece({ id: "5", type: "v", client_id: "b", status: "publicado" }), // otro cliente
  ];
  assert.deepEqual(monthProgress(pieces, "a", 11), {
    reels: { done: 1, total: 2 },
    fotos: { done: 1, total: 1 },
  });
});

test("pautaProgress cuenta posts publicados del mes y deja fuera las semanas que Publicaciones no muestra", () => {
  const posts = [
    { client_id: "b", year: 2026, month: 10, week: 1, published: true },
    { client_id: "b", year: 2026, month: 10, week: 4, published: false },
    { client_id: "b", year: 2026, month: 10, week: 5, published: false }, // semana 5: oculta en Publicaciones
    { client_id: "b", year: 2026, month: 9, week: 1, published: true },
  ] as PautaPost[];
  assert.deepEqual(pautaProgress(posts, "b", 2026, 10, 4), { done: 1, total: 2 });
});

test("monthProgress con paquete usa la cuota del paquete como total y deja pasar publicadas de más", () => {
  const pieces = [
    piece({ id: "1", type: "v", status: "publicado" }),
    piece({ id: "2", type: "v", status: "publicado" }),
    piece({ id: "3", type: "v", status: "revision" }),
    piece({ id: "4", type: "f", status: "publicado" }),
  ];
  assert.deepEqual(monthProgress(pieces, "a", 11, { reels: 1, fotos: 4 }), {
    reels: { done: 2, total: 1 },
    fotos: { done: 1, total: 4 },
  });
  // cliente sin piezas este mes: la cuota igual aparece completa
  assert.deepEqual(monthProgress(pieces, "nadie", 11, { reels: 4, fotos: 4 }), {
    reels: { done: 0, total: 4 },
    fotos: { done: 0, total: 4 },
  });
});

test("initialsOf toma dos iniciales y tolera nombres con barra o de una palabra", () => {
  assert.equal(initialsOf("Tres Leches"), "TL");
  assert.equal(initialsOf("Genco/Metbros"), "GM");
  assert.equal(initialsOf("Carpe"), "CA");
  assert.equal(initialsOf("  "), "?");
});
