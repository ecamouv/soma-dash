"use client";

import { useMemo } from "react";
import type { CalendarEvent } from "@/lib/types";
import { EVENT_TYPE_COLOR } from "@/lib/types";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = lunes
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - firstWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function CalendarView({
  month,
  events,
  onMonthChange,
  onDayClick,
  onEventClick,
}: {
  month: Date;
  events: CalendarEvent[];
  onMonthChange: (m: Date) => void;
  onDayClick: (dateISO: string) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const days = useMemo(() => buildGrid(month), [month]);
  const todayISO = toISO(new Date());

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.event_date) ?? [];
      list.push(e);
      map.set(e.event_date, list);
    }
    return map;
  }, [events]);

  function changeMonth(delta: number) {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  return (
    <div className="mx-6 mb-8 mt-6 overflow-hidden rounded-card border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-text">
          {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onMonthChange(new Date())}
            className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-text hover:bg-panel2"
          >
            Hoy
          </button>
          <button
            onClick={() => changeMonth(-1)}
            aria-label="Mes anterior"
            className="rounded-md border border-line px-2.5 py-1.5 text-sm text-muted hover:text-text hover:bg-panel2"
          >
            ‹
          </button>
          <button
            onClick={() => changeMonth(1)}
            aria-label="Mes siguiente"
            className="rounded-md border border-line px-2.5 py-1.5 text-sm text-muted hover:text-text hover:bg-panel2"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line bg-panel2/40">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="px-2 py-2 text-center text-[11px] font-medium text-muted"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d) => {
          const iso = toISO(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = iso === todayISO;
          const dayEvents = eventsByDate.get(iso) ?? [];
          const visible = dayEvents.slice(0, 2);
          const overflow = dayEvents.length - visible.length;

          return (
            <button
              key={iso}
              onClick={() => onDayClick(iso)}
              className={[
                "flex min-h-[104px] flex-col items-stretch gap-1 border-b border-r border-line px-2 py-2 text-left transition hover:bg-panel2/60",
                inMonth ? "bg-transparent" : "bg-ink/40",
              ].join(" ")}
            >
              <span
                className={[
                  "mb-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isToday
                    ? "bg-brand text-on-primary font-semibold"
                    : inMonth
                    ? "text-text"
                    : "text-muted/40",
                ].join(" ")}
              >
                {d.getDate()}
              </span>

              <div className="flex flex-1 flex-col gap-1">
                {visible.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev);
                    }}
                    className="truncate rounded px-1.5 py-1 text-[11px] leading-tight text-white/95"
                    style={{ background: `${EVENT_TYPE_COLOR[ev.event_type]}33`, borderLeft: `2px solid ${EVENT_TYPE_COLOR[ev.event_type]}` }}
                  >
                    {ev.event_time?.slice(0, 5) ?? ""} {ev.title}
                  </div>
                ))}
                {overflow > 0 && (
                  <span className="px-1.5 text-[11px] text-muted">
                    +{overflow} más
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}