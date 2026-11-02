import { test } from "node:test";
import assert from "node:assert/strict";
import { atRisk, publishQueue, unscheduledPauta } from "./communityHome.ts";
import type { ContentPiece } from "@/lib/types";
import type { PautaPost } from "@/lib/pauta";

const TODAY = "2026-10-28";
const piece = (o: Partial<ContentPiece> & { id: string }): ContentPiece =>
  ({ client_id: "a", code: "11.v.1", type: "v", month: 10, status: "aprobado", due_date: "2026-10-29", ...o }) as ContentPiece;
const post = (o: Partial<PautaPost> & { id: string }): PautaPost =>
  ({ client_id: "p", year: 2026, month: 10, week: 1, slot: 1, name: "Post", scheduled_date: null, published: false, ...o }) as PautaPost;

test("publishQueue: incluye atrasadas y hasta 7 días, deja fuera publicadas, sin fecha y lejanas", () => {
  const q = publishQueue(
    [
      piece({ id: "late", due_date: "2026-10-20" }),
      piece({ id: "tomorrow", due_date: "2026-10-29", status: "en_edicion" }),
      piece({ id: "edge", due_date: "2026-11-04" }),
      piece({ id: "far", due_date: "2026-11-05" }),
      piece({ id: "done", status: "publicado" }),
      piece({ id: "nodate", due_date: null }),
    ],
    [post({ id: "x", scheduled_date: "2026-10-30" }), post({ id: "y", scheduled_date: "2026-10-30", published: true }), post({ id: "z" })],
    TODAY
  );
  assert.deepEqual(q.map((r) => r.id), ["late", "tomorrow", "x", "edge"]);
});

test("publishQueue: solo las piezas aprobadas se pueden publicar; los posts siempre", () => {
  const q = publishQueue(
    [piece({ id: "ok" }), piece({ id: "edit", status: "en_edicion" }), piece({ id: "rev", status: "revision" })],
    [post({ id: "x", scheduled_date: "2026-10-29" })],
    TODAY
  );
  const by = Object.fromEntries(q.map((r) => [r.id, r.publishable]));
  assert.deepEqual(by, { ok: true, edit: false, rev: false, x: true });
});

test("atRisk: no aprobadas que salen hoy, mañana o antes; ignora aprobadas, posts y fechas posteriores", () => {
  const q = publishQueue(
    [
      piece({ id: "r1", status: "en_edicion", due_date: "2026-10-29" }),
      piece({ id: "r2", status: "por_grabar", due_date: "2026-10-26" }),
      piece({ id: "r3", status: "revision", due_date: "2026-10-28" }),
      piece({ id: "safe", status: "aprobado", due_date: "2026-10-29" }),
      piece({ id: "later", status: "en_edicion", due_date: "2026-10-30" }),
    ],
    [post({ id: "x", scheduled_date: "2026-10-29" })],
    TODAY
  );
  assert.deepEqual(atRisk(q, TODAY).map((r) => r.id), ["r2", "r3", "r1"]);
});

test("unscheduledPauta cuenta posts del mes sin fecha ni publicar, sin la semana 5", () => {
  const g = unscheduledPauta(
    [
      post({ id: "1" }),
      post({ id: "2", scheduled_date: "2026-10-05" }),
      post({ id: "3", published: true }),
      post({ id: "4", week: 5 }),
      post({ id: "5", month: 9 }),
      post({ id: "6", client_id: "q" }),
    ],
    2026,
    10,
    4
  );
  assert.deepEqual(g, [
    { clientId: "p", count: 1 },
    { clientId: "q", count: 1 },
  ]);
});
