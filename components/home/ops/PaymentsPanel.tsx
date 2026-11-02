"use client";

import { LuCheck } from "react-icons/lu";
import { periodLabel, type BillLine } from "@/lib/billing";
import { formatMXN, formatShort } from "@/lib/opsHome";
import type { Client } from "@/lib/types";

/** Casilla de pagado. Mismo componente para el mes en curso y para los adeudos. */
export function PaidCheckbox({ paid, label, onChange }: { paid: boolean; label: string; onChange: (paid: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={paid}
      aria-label={label}
      title={label}
      onClick={() => onChange(!paid)}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
        paid ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-line text-transparent hover:border-emerald-500"
      }`}
    >
      <LuCheck className="h-3.5 w-3.5" />
    </button>
  );
}

/** Meses anteriores sin pagar. Aparece solo si hay alguno; al marcar la casilla el renglón sale. */
export function OverdueBubble({
  lines,
  clientById,
  colorMap,
  onSetPaid,
}: {
  lines: BillLine[];
  clientById: Map<string, Client>;
  colorMap: Map<string, string>;
  onSetPaid: (line: BillLine, paid: boolean) => void;
}) {
  if (lines.length === 0) return null;
  const total = lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  return (
    <section className="rounded-2xl border border-crimson/40 bg-crimson/10 p-5" role="alert">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-crimson">
          Pagos de meses anteriores sin registrar · {lines.length}
        </h2>
        {total > 0 && <span className="text-xs font-semibold tabular-nums text-crimson">{formatMXN(total)}</span>}
      </div>
      <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {lines.map((line) => {
          const client = clientById.get(line.clientId);
          return (
            <li key={`${line.clientId}|${line.period}`} className="flex items-center gap-3 text-xs">
              <PaidCheckbox
                paid={false}
                label={`Marcar ${periodLabel(line.period)} de ${client?.name ?? "cliente"} como pagado`}
                onChange={(paid) => onSetPaid(line, paid)}
              />
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorMap.get(line.clientId) }} />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-text">{client?.name ?? "Cliente"}</span>
                <span className="text-muted"> · {periodLabel(line.period)} · debía el {formatShort(line.dueDate)}</span>
              </span>
              <span className="shrink-0 tabular-nums text-text">{line.amount != null ? formatMXN(line.amount) : "Sin precio"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function PaymentsPanel({
  lines,
  available,
  clientById,
  colorMap,
  todayISO,
  onSetPaid,
}: {
  lines: BillLine[];
  available: boolean;
  clientById: Map<string, Client>;
  colorMap: Map<string, string>;
  todayISO: string;
  onSetPaid: (line: BillLine, paid: boolean) => void;
}) {
  const pending = lines.filter((l) => !l.paid).length;
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-text">Pagos del mes</h2>
        <span className="text-[11px] text-muted">
          {pending} {pending === 1 ? "pendiente" : "pendientes"}
        </span>
      </div>

      {!available ? (
        <p className="text-xs text-muted">Faltan las tablas de cobro: aplica la migración en Supabase.</p>
      ) : lines.length === 0 ? (
        <p className="text-xs text-muted">Ningún cliente tiene pago mensual configurado. Se configura en Clientes.</p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {lines.map((line) => {
            const client = clientById.get(line.clientId);
            const late = !line.paid && line.dueDate < todayISO;
            return (
              <li key={line.clientId} className="flex items-center gap-2 text-xs">
                <PaidCheckbox
                  paid={line.paid}
                  label={`${line.paid ? "Desmarcar" : "Marcar"} pago de ${client?.name ?? "cliente"}`}
                  onChange={(paid) => onSetPaid(line, paid)}
                />
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorMap.get(line.clientId) }} />
                <span className={`w-14 shrink-0 ${late ? "text-crimson" : "text-muted"}`}>{formatShort(line.dueDate)}</span>
                <span className={`min-w-0 flex-1 truncate font-medium ${line.paid ? "text-muted line-through" : "text-text"}`}>
                  {client?.name ?? "Cliente"}
                </span>
                <span className={`shrink-0 tabular-nums ${late ? "text-crimson" : line.paid ? "text-muted" : "text-text"}`}>
                  {line.amount != null ? formatMXN(line.amount) : "Sin precio"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
