"use client";

import { useMemo, useState } from "react";
import { EVENT_TYPE_COLOR, PIECE_STATUS_COLOR, pieceLabel } from "@/lib/types";
import { pieceDate, weekDays, type WeeklyRecap } from "@/lib/weekly";
import { WEEKDAYS } from "@/lib/utils";
import { weekDuePieces } from "./WeekHeadline";

/** Curva suave (Catmull-Rom convertida a Bézier) a través de los puntos dados. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function WeekCurve({ recap, todayISO }: { recap: WeeklyRecap; todayISO: string }) {
  const days = useMemo(() => weekDays(recap.range), [recap.range]);
  const dueThisWeek = useMemo(() => weekDuePieces(recap), [recap]);

  const byDay = useMemo(
    () =>
      days.map((d) => ({
        date: d,
        events: recap.events.filter((e) => e.event_date.slice(0, 10) === d),
        pieces: dueThisWeek.filter((p) => pieceDate(p) === d),
      })),
    [days, recap.events, dueThisWeek]
  );
  const load = byDay.map((d) => d.events.length + d.pieces.length);

  const firstBusy = load.findIndex((n) => n > 0);
  const todayIdx = days.indexOf(todayISO);
  const [selected, setSelected] = useState<number | null>(null);
  const active = selected ?? (todayIdx >= 0 ? todayIdx : firstBusy >= 0 ? firstBusy : 0);

  // Escala fija mínima para que una semana tranquila no se vea exagerada.
  const max = Math.max(4, ...load);
  const pts = load.map((n, i) => ({ x: ((i + 0.5) / 7) * 100, y: 88 - (n / max) * 68 }));
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1].x} 100 L ${pts[0].x} 100 Z`;

  const day = byDay[active];

  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-text">Carga de la semana</h2>
        <span className="text-[11px] text-muted">Eventos y entregas por día</span>
      </div>

      <div className="relative h-28">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="week-curve-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--color-primary)", stopOpacity: 0.28 }} />
              <stop offset="100%" style={{ stopColor: "var(--color-primary)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#week-curve-fill)" />
          <path
            d={line}
            fill="none"
            style={{ stroke: "var(--color-primary)" }}
            strokeWidth="2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {pts.map((p, i) => (
          <span
            key={i}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all ${
              i === active ? "h-3 w-3 ring-4 ring-primary/25" : "h-1.5 w-1.5"
            }`}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              backgroundColor: load[i] > 0 || i === active ? "var(--color-primary)" : "var(--color-ink-faint)",
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-7">
        {byDay.map((d, i) => (
          <button
            key={d.date}
            type="button"
            onClick={() => setSelected(i)}
            className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] transition hover:bg-panel2 ${
              i === active ? "bg-panel2 font-semibold text-text" : "text-muted"
            }`}
          >
            <span>{WEEKDAYS[i]}</span>
            <span className={d.date === todayISO ? "text-primary" : ""}>
              {Number(d.date.slice(8, 10))}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        {day.events.length === 0 && day.pieces.length === 0 ? (
          <p className="text-xs text-muted">Sin eventos ni entregas este día.</p>
        ) : (
          <ul className="space-y-1.5">
            {day.events.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: EVENT_TYPE_COLOR[e.event_type] }}
                />
                <span className="font-medium text-text">{e.title}</span>
                {e.client?.name && <span className="text-muted">· {e.client.name}</span>}
                {e.event_time && <span className="ml-auto text-muted">{e.event_time.slice(0, 5)}</span>}
              </li>
            ))}
            {day.pieces.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: PIECE_STATUS_COLOR[p.status] }}
                />
                <span className="font-medium text-text">{pieceLabel(p)}</span>
                {p.client?.name && <span className="text-muted">· {p.client.name}</span>}
                <span className="ml-auto text-muted">entrega</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
