"use client";

import { useMemo } from "react";
import Link from "next/link";
import { LuArrowRight } from "react-icons/lu";
import ClientAvatar from "@/components/home/ops/ClientAvatar";
import { formatShort, pieceName, type RevisionGroup } from "@/lib/opsHome";

const FALLBACK_COLOR = "#94a3b8";

const COLUMNS = "grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_3.5rem_4.5rem] items-center gap-3";

export default function RevisionPanel({
  groups,
  colorMap,
  todayISO,
}: {
  groups: RevisionGroup[];
  colorMap: Map<string, string>;
  todayISO: string;
}) {
  const rows = useMemo(
    () =>
      groups
        .flatMap((g) => g.pieces.map((p) => ({ piece: p, clientId: g.clientId, clientName: g.clientName })))
        .sort(
          (a, b) =>
            (a.piece.due_date ?? "9999").localeCompare(b.piece.due_date ?? "9999") ||
            a.clientName.localeCompare(b.clientName)
        ),
    [groups]
  );

  const isLate = (due: string | null | undefined) => !!due && due.slice(0, 10) < todayISO;

  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-text">En revisión</h2>
        <span className="text-[11px] text-muted">
          {rows.length} {rows.length === 1 ? "pieza" : "piezas"} esperando respuesta
        </span>
      </div>

      <div className="mb-2 flex border-b border-line">
        <span className="-mb-px border-b-2 border-text pb-2 text-xs font-semibold text-text">
          Todas
          <span className="ml-1.5 tabular-nums text-muted">{rows.length}</span>
        </span>
      </div>

      <div className={`${COLUMNS} px-1 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted`}>
        <span>Pieza</span>
        <span>Cliente</span>
        <span>Tipo</span>
        <span className="text-right">Fecha</span>
      </div>

      {rows.length === 0 ? (
        <p className="px-1 py-4 text-xs text-muted">Ninguna pieza está en revisión.</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {rows.map(({ piece, clientId, clientName }) => {
            const color = colorMap.get(clientId) ?? FALLBACK_COLOR;
            const due = piece.due_date?.slice(0, 10) ?? null;
            const name = pieceName(piece);
            return (
              <li key={piece.id} className={`${COLUMNS} whitespace-nowrap border-t border-line px-1 py-2.5 text-xs`}>
                <span className="truncate font-medium text-text" title={name}>
                  {name}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <ClientAvatar name={clientName} color={color} size={22} />
                  <span className="truncate font-medium" style={{ color }} title={clientName}>
                    {clientName}
                  </span>
                </span>
                <span className="text-muted">{piece.type === "v" ? "Reel" : "Foto"}</span>
                <span className={`text-right tabular-nums ${isLate(due) ? "text-crimson" : "text-muted"}`}>
                  {due ? formatShort(due) : "Sin fecha"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/entregas"
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-text"
      >
        Ver en Entregas <LuArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}
