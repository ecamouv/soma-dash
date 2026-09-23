"use client";

import { useEffect, useMemo, useState } from "react";
import { LuVideo, LuUsers, LuPackage, LuReceipt, LuChevronLeft, LuChevronRight, LuX, LuClock, LuMapPin } from "react-icons/lu";

export type PublicCalendarItemType = "grabacion" | "junta" | "entrega" | "pago";

export interface PublicCalendarItem {
  date: string; // YYYY-MM-DD
  type: PublicCalendarItemType;
  title: string;
  time?: string | null;
  location?: string | null;
}

// Paleta neutra propia de esta vista (hueso/carbón/humo) -- independiente de la
// paleta del dashboard interno, no reutiliza tokens de tailwind.config.
const TYPE_META: Record<
  PublicCalendarItemType,
  { label: string; icon: typeof LuVideo; chip: string }
> = {
  grabacion: {
    label: "Grabación",
    icon: LuVideo,
    chip: "bg-[#2A2823] text-white",
  },
  junta: {
    label: "Junta",
    icon: LuUsers,
    chip: "bg-white text-[#2A2823] border border-[#2A2823]",
  },
  entrega: {
    label: "Entrega de contenido",
    icon: LuPackage,
    chip: "bg-[#ECE7DC] text-[#2A2823]",
  },
  pago: {
    label: "Pago",
    icon: LuReceipt,
    chip: "bg-white text-[#2A2823] border border-dashed border-[#8A8680]",
  },
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export default function PublicCalendarView({ items }: { items: PublicCalendarItem[] }) {
  const [month, setMonth] = useState(() => new Date());
  const days = useMemo(() => buildGrid(month), [month]);
  const todayISO = toISO(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedDate(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDate]);


  const itemsByDate = useMemo(() => {
    const map = new Map<string, PublicCalendarItem[]>();
    for (const item of items) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [items]);

  const selectedItems = selectedDate ? itemsByDate.get(selectedDate) ?? [] : [];

  return (
    <div className="space-y-4">
      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 rounded-2xl border border-[#E6E2DA] bg-white px-4 py-3 shadow-sm">
        {(Object.keys(TYPE_META) as PublicCalendarItemType[]).map((type) => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          return (
            <div key={type} className="flex items-center gap-1.5 text-xs text-[#2A2823]">
              <span className={`flex h-5 w-5 items-center justify-center rounded ${meta.chip}`}>
                <Icon className="h-3 w-3" />
              </span>
              {meta.label}
            </div>
          );
        })}
      </div>

      {/* Navegación de mes */}
      <div className="flex items-center justify-between rounded-2xl border border-[#E6E2DA] bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => setMonth(new Date())}
          className="rounded-md border border-[#E6E2DA] px-3 py-1.5 text-xs text-[#8A8680] hover:text-[#2A2823] hover:bg-[#F7F5F2] transition"
        >
          Hoy
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            aria-label="Mes anterior"
            className="rounded-md border border-[#E6E2DA] p-1.5 text-[#8A8680] hover:text-[#2A2823] hover:bg-[#F7F5F2] transition"
          >
            <LuChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-semibold text-sm text-[#2A2823] min-w-[140px] text-center">
            {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
          </span>
          <button
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            aria-label="Mes siguiente"
            className="rounded-md border border-[#E6E2DA] p-1.5 text-[#8A8680] hover:text-[#2A2823] hover:bg-[#F7F5F2] transition"
          >
            <LuChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="w-[68px]" />
      </div>

      {/* Calendario mensual */}
      <div className="overflow-hidden rounded-2xl border border-[#E6E2DA] bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-[#E6E2DA] bg-[#F7F5F2]">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-2 text-center text-[11px] font-medium text-[#8A8680]">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((d) => {
            const iso = toISO(d);
            const inMonth = d.getMonth() === month.getMonth();
            const isToday = iso === todayISO;
            const dayItems = itemsByDate.get(iso) ?? [];

            return (
              <div
                key={iso}
                role={dayItems.length > 0 ? "button" : undefined}
                tabIndex={dayItems.length > 0 ? 0 : undefined}
                onClick={dayItems.length > 0 ? () => setSelectedDate(iso) : undefined}
                onKeyDown={
                  dayItems.length > 0
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedDate(iso);
                        }
                      }
                    : undefined
                }
                className={[
                  "flex min-h-[104px] max-h-[168px] flex-col gap-1 overflow-y-auto border-b border-r border-[#E6E2DA] px-1.5 py-1.5",
                  inMonth ? "bg-white" : "bg-[#FAF9F6]",
                  dayItems.length > 0 ? "cursor-pointer transition hover:bg-[#F7F5F2]" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "mb-0.5 inline-flex h-5 w-5 items-center justify-center self-start rounded-full text-[11px]",
                    isToday
                      ? "bg-[#2A2823] text-white font-semibold"
                      : inMonth
                      ? "text-[#2A2823]"
                      : "text-[#C9C4B8]",
                  ].join(" ")}
                >
                  {d.getDate()}
                </span>

                {dayItems.map((item, i) => {
                  const meta = TYPE_META[item.type];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] leading-tight ${meta.chip}`}
                    >
                      <Icon className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {selectedDate && selectedItems.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedDate(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#E6E2DA] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold capitalize text-[#2A2823]">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("es-MX", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <p className="text-xs text-[#8A8680]">
                  {selectedItems.length} {selectedItems.length === 1 ? "elemento" : "elementos"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                aria-label="Cerrar"
                className="-m-1 rounded-md p-1 text-[#8A8680] hover:bg-[#F7F5F2] hover:text-[#2A2823]"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>

            <ul className="space-y-3">
              {selectedItems.map((item, i) => {
                const meta = TYPE_META[item.type];
                const Icon = meta.icon;
                return (
                  <li key={i} className="space-y-1.5 rounded-xl border border-[#E6E2DA] p-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                    <p className="break-words text-sm font-semibold text-[#2A2823]">{item.title}</p>
                    {(item.time || item.location) && (
                      <div className="space-y-1 text-xs text-[#8A8680]">
                        {item.time && (
                          <p className="flex items-center gap-1.5">
                            <LuClock className="h-3 w-3" /> {item.time}
                          </p>
                        )}
                        {item.location && (
                          <p className="flex items-center gap-1.5">
                            <LuMapPin className="h-3 w-3" /> {item.location}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
