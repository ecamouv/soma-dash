"use client";

import { useMemo } from "react";
import { LuVideo, LuMapPin, LuCalendarDays, LuClapperboard } from "react-icons/lu";
import type { CalendarEvent } from "@/lib/types";
import { weekRange } from "@/lib/weekly";
import { iso } from "@/lib/utils";

export default function StatsBar({ events }: { events: CalendarEvent[] }) {
  const stats = useMemo(() => {
    const todayISO = iso(new Date());
    const week = weekRange();

    const grabaciones = events.filter((e) => e.event_type === "grabacion");

    const grabacionesMes = grabaciones.length;

    const grabacionesHoy = grabaciones.filter(
      (e) => e.event_date === todayISO
    ).length;

    const grabacionesSemana = grabaciones.filter(
      (e) => e.event_date >= week.start && e.event_date <= week.end
    ).length;

    const piezasContenido = grabaciones.reduce(
      (sum, e) => sum + e.content_pieces.length,
      0
    );

    return { grabacionesMes, grabacionesHoy, grabacionesSemana, piezasContenido };
  }, [events]);

  const cards = [
    { label: "Total del mes", value: stats.grabacionesMes, Icon: LuVideo },
    { label: "Grabaciones hoy", value: stats.grabacionesHoy, Icon: LuMapPin },
    { label: "Esta semana", value: stats.grabacionesSemana, Icon: LuCalendarDays },
    { label: "Contenido a grabar", value: stats.piezasContenido, Icon: LuClapperboard },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 px-6 pt-6 sm:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="flex items-center gap-3 rounded-card border border-line bg-panel px-4 py-3.5 shadow-sm"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel2 text-muted">
            <c.Icon className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-eyebrow text-muted">{c.label}</p>
            <p className="font-display text-xl font-bold tabular-nums text-text leading-tight">
              {c.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}