"use client";

import { useState } from "react";
import { LuChevronRight } from "react-icons/lu";
import { EVENT_TYPE_COLOR, type CalendarEvent } from "@/lib/types";

function formatDay(dateISO: string): string {
  return new Date(`${dateISO.slice(0, 10)}T00:00:00`).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
  });
}

export default function NextWeek({ events }: { events: CalendarEvent[] }) {
  const [open, setOpen] = useState(false);
  const empty = events.length === 0;

  return (
    <section className="rounded-2xl border border-line bg-panel shadow-sm">
      <button
        type="button"
        disabled={empty}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-5 py-4 text-left disabled:cursor-default"
      >
        <LuChevronRight
          className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-90" : ""} ${empty ? "opacity-0" : ""}`}
        />
        <span className="text-sm font-bold text-text">Próxima semana</span>
        <span className="ml-auto text-xs text-muted">
          {empty ? "Nada agendado" : `${events.length} ${events.length === 1 ? "evento" : "eventos"}`}
        </span>
      </button>
      {open && !empty && (
        <ul className="space-y-1.5 border-t border-line px-5 py-4">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: EVENT_TYPE_COLOR[e.event_type] }}
              />
              <span className="w-14 shrink-0 text-muted">{formatDay(e.event_date)}</span>
              <span className="font-medium text-text">{e.title}</span>
              {e.client?.name && <span className="text-muted">· {e.client.name}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
