"use client";

import Link from "next/link";
import { LuArrowRight } from "react-icons/lu";
import { formatDay } from "@/lib/opsHome";
import type { CalendarEvent } from "@/lib/types";

export default function MeetingsPanel({
  meetings,
  colorMap,
  todayISO,
}: {
  meetings: CalendarEvent[];
  colorMap: Map<string, string>;
  todayISO: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-text">Juntas con clientes</h2>
        <span className="text-[11px] text-muted">Próximos 7 días</span>
      </div>

      {meetings.length === 0 ? (
        <p className="text-xs text-muted">No hay juntas con clientes esta semana.</p>
      ) : (
        <ul className="space-y-1.5">
          {meetings.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: (m.client_id && colorMap.get(m.client_id)) || "var(--color-ink-muted)" }}
              />
              <span className="w-16 shrink-0 text-muted">{formatDay(m.event_date.slice(0, 10), todayISO)}</span>
              {m.event_time && <span className="w-10 shrink-0 tabular-nums text-muted">{m.event_time.slice(0, 5)}</span>}
              <span className="font-medium text-text">{m.title}</span>
              {m.client?.name && <span className="text-muted">· {m.client.name}</span>}
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/calendario"
        className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-text"
      >
        Ver calendario <LuArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}
