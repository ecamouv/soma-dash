"use client";

import { useState } from "react";
import Link from "next/link";
import { LuArrowRight } from "react-icons/lu";
import { pieceLabel, type ContentPiece, type PieceStatus } from "@/lib/types";
import { pieceDate } from "@/lib/weekly";

const STAGES: { status: Exclude<PieceStatus, "publicado">; label: string; color: string }[] = [
  { status: "por_grabar", label: "Por grabar", color: "var(--color-ink-muted)" },
  { status: "en_edicion", label: "En edición", color: "var(--color-accent-sky)" },
  { status: "revision", label: "En revisión", color: "var(--color-accent-orange)" },
  { status: "aprobado", label: "Aprobado", color: "var(--color-accent-green)" },
];

const VISIBLE = 6;

function shortDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export default function PipelineBar({
  pieces,
  todayISO,
}: {
  pieces: ContentPiece[];
  todayISO: string;
}) {
  const [open, setOpen] = useState<PieceStatus | null>(null);
  const total = pieces.length;

  const counts = STAGES.map((s) => ({ ...s, n: pieces.filter((p) => p.status === s.status).length }));
  const openStage = counts.find((c) => c.status === open);
  const list = openStage
    ? pieces
        .filter((p) => p.status === openStage.status)
        .sort((a, b) => (pieceDate(a) ?? "9999").localeCompare(pieceDate(b) ?? "9999"))
    : [];

  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-text">Flujo de piezas</h2>
        <span className="text-[11px] text-muted">{total} abiertas</span>
      </div>

      {total === 0 ? (
        <p className="text-xs text-muted">No hay piezas abiertas.</p>
      ) : (
        <>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {counts
              .filter((c) => c.n > 0)
              .map((c) => (
                <button
                  key={c.status}
                  type="button"
                  aria-label={`${c.label}: ${c.n}`}
                  onClick={() => setOpen(open === c.status ? null : c.status)}
                  className="h-full transition-opacity hover:opacity-80"
                  style={{
                    width: `${(c.n / total) * 100}%`,
                    backgroundColor: c.color,
                    opacity: open && open !== c.status ? 0.35 : 1,
                  }}
                />
              ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {counts.map((c) => (
              <button
                key={c.status}
                type="button"
                onClick={() => setOpen(open === c.status ? null : c.status)}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-panel2 ${
                  open === c.status ? "bg-panel2" : ""
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-xs text-muted">{c.label}</span>
                <span className="ml-auto text-sm font-bold tabular-nums text-text">{c.n}</span>
              </button>
            ))}
          </div>

          {openStage && (
            <div className="mt-3 space-y-1.5 border-t border-line pt-3">
              {list.slice(0, VISIBLE).map((p) => {
                const d = pieceDate(p);
                const late = !!d && d < todayISO;
                return (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-text">{pieceLabel(p)}</span>
                    {p.client?.name && <span className="text-muted">· {p.client.name}</span>}
                    <span className={`ml-auto ${late ? "text-accent-orange" : "text-muted"}`}>
                      {d ? shortDate(d) : "Sin fecha"}
                    </span>
                  </div>
                );
              })}
              {list.length > VISIBLE && (
                <Link
                  href="/entregas"
                  className="flex items-center gap-1 pt-1 text-xs font-semibold text-primary hover:underline"
                >
                  Ver las {list.length} en Entregas <LuArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
