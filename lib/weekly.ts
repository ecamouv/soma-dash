import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent, Client, ContentPiece } from "@/lib/types";
import { iso } from "@/lib/utils";

export interface WeekRange {
  start: string; // lunes, YYYY-MM-DD
  end: string; // domingo, YYYY-MM-DD
}

/** Semana lunes-domingo, desplazada `offset` semanas respecto a hoy. */
export function weekRange(offset = 0): WeekRange {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day) + offset * 7);
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return { start: iso(d), end: iso(end) };
}

/** Los 7 días (YYYY-MM-DD) de una semana, de lunes a domingo. */
export function weekDays(range: WeekRange): string[] {
  const start = new Date(`${range.start}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return iso(d);
  });
}

/** Fecha efectiva de una pieza: su fecha de entrega, o la del evento de grabación ligado. */
export function pieceDate(piece: ContentPiece): string | null {
  if (piece.due_date) return piece.due_date;
  if (piece.event?.event_date) return piece.event.event_date.slice(0, 10);
  return null;
}

export interface WeeklyRecap {
  range: WeekRange;
  // Eventos de la semana (clientes pausados excluidos).
  events: CalendarEvent[];
  // Todas las piezas que aún no están publicadas, de cualquier fecha.
  openPieces: ContentPiece[];
  // Eventos de la semana siguiente.
  upcoming: CalendarEvent[];
}

export async function fetchWeeklyRecap(range: WeekRange): Promise<WeeklyRecap> {
  const supabase = createClient();

  const nextStart = new Date(`${range.end}T00:00:00`);
  nextStart.setDate(nextStart.getDate() + 1);
  const nextEnd = new Date(nextStart);
  nextEnd.setDate(nextStart.getDate() + 6);

  const [events, pieces, clients, upcoming] = await Promise.all([
    supabase
      .from("events")
      .select("*, client:clients(*), content_pieces(*)")
      .gte("event_date", range.start)
      .lte("event_date", range.end)
      .order("event_date", { ascending: true }),
    supabase
      .from("content_pieces")
      .select("*, client:clients(*), event:events(event_date)")
      .neq("status", "publicado"),
    supabase.from("clients").select("id, name, paused, color"),
    supabase
      .from("events")
      .select("*, client:clients(*), content_pieces(*)")
      .gte("event_date", iso(nextStart))
      .lte("event_date", iso(nextEnd))
      .order("event_date", { ascending: true }),
  ]);

  for (const r of [events, pieces, clients, upcoming]) {
    if (r.error) throw r.error;
  }

  const clientById = new Map(((clients.data ?? []) as Client[]).map((c) => [c.id, c]));
  const isActive = (id?: string | null) => !id || !clientById.get(id)?.paused;

  return {
    range,
    events: ((events.data ?? []) as CalendarEvent[]).filter((e) => isActive(e.client_id)),
    openPieces: ((pieces.data ?? []) as ContentPiece[]).filter((p) => isActive(p.client_id)),
    upcoming: ((upcoming.data ?? []) as CalendarEvent[]).filter((e) => isActive(e.client_id)),
  };
}
