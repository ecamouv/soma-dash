import ClientAvatar from "@/components/home/ops/ClientAvatar";
import { STATUS_LABEL, type QueueRow } from "@/lib/communityHome";
import { formatDay } from "@/lib/opsHome";
import { PIECE_STATUS_COLOR } from "@/lib/types";

function StatusChip({ status }: { status: QueueRow["status"] }) {
  const color = status === "post" ? "var(--color-accent-pink)" : PIECE_STATUS_COLOR[status];
  return (
    <span
      className="w-fit rounded-md px-2 py-0.5 text-[11px] font-medium"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)` }}
    >
      {status === "post" ? "Pauta" : STATUS_LABEL[status]}
    </span>
  );
}

const FALLBACK_COLOR = "#94a3b8";

/** Piezas que salen hoy o mañana (o ya se pasaron) y todavía no están aprobadas. */
export default function AtRiskPanel({
  rows,
  clientNames,
  colorMap,
  todayISO,
}: {
  rows: QueueRow[];
  clientNames: Map<string, string>;
  colorMap: Map<string, string>;
  todayISO: string;
}) {
  return (
    <section className={`rounded-2xl border p-5 shadow-sm ${rows.length > 0 ? "border-crimson/40 bg-crimson/10" : "border-line bg-panel"}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className={`text-sm font-bold ${rows.length > 0 ? "text-crimson" : "text-text"}`}>En riesgo</h2>
        <span className="text-[11px] text-muted">Salen hoy o mañana y no están aprobadas</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted">Todo lo que sale hoy o mañana ya está aprobado.</p>
      ) : (
        <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {rows.map((row) => {
            const name = clientNames.get(row.clientId) ?? "Cliente";
            return (
              <li key={row.key} className="flex items-center gap-3 text-xs">
                <ClientAvatar name={name} color={colorMap.get(row.clientId) ?? FALLBACK_COLOR} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text" title={row.name}>
                    {row.name}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {name} · {row.date < todayISO ? "atrasada, era " : "sale "}
                    {formatDay(row.date, todayISO).toLowerCase()}
                  </p>
                </div>
                <StatusChip status={row.status} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
