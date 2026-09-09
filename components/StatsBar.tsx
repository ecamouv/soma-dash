"use client";

import { useMemo } from "react";
import type { CalendarEvent } from "@/lib/types";

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day; // semana inicia en lunes
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export default function StatsBar({ events }: { events: CalendarEvent[] }) {
  const stats = useMemo(() => {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);

    const grabaciones = events.filter((e) => e.event_type === "grabacion");

    const grabacionesMes = grabaciones.length;

    const grabacionesHoy = grabaciones.filter(
      (e) => e.event_date === todayISO
    ).length;

    const grabacionesSemana = grabaciones.filter((e) => {
      const d = new Date(e.event_date + "T00:00:00");
      return d >= weekStart && d <= weekEnd;
    }).length;

    const piezasContenido = grabaciones.reduce(
      (sum, e) => sum + e.content_pieces.length,
      0
    );

    return { grabacionesMes, grabacionesHoy, grabacionesSemana, piezasContenido };
  }, [events]);

  const cards = [
    { label: "Total del mes", value: stats.grabacionesMes, icon: "🎥" },
    { label: "Grabaciones hoy", value: stats.grabacionesHoy, icon: "📍" },
    { label: "Grabaciones esta semana", value: stats.grabacionesSemana, icon: "📅" },
    { label: "Contenido a grabar", value: stats.piezasContenido, icon: "🎬" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 px-6 pt-6 sm:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-card border border-line bg-panel px-4 py-3.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted">{c.label}</span>
            <span className="text-base leading-none">{c.icon}</span>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold text-text">
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}