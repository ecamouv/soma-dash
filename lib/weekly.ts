import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent, Client, ClientPayment, ContentPiece, Prospect } from "@/lib/types";

export interface WeekRange {
  start: string; // lunes, YYYY-MM-DD
  end: string; // domingo, YYYY-MM-DD
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

export interface ProspectActivityRow {
  id: string;
  prospect_id: string;
  note: string;
  created_at: string;
  prospect?: { name: string } | null;
}

export interface WeeklyRecap {
  range: WeekRange;
  events: CalendarEvent[];
  // Piezas con status "publicado" (estado final) cuya fecha de entrega cae en la semana.
  publishedPieces: ContentPiece[];
  shotClients: { client: Client; pieces: number }[];
  payments: (ClientPayment & { client?: Client })[];
  newProspects: Prospect[];
  prospectActivity: ProspectActivityRow[];
  upcoming: CalendarEvent[];
}

export async function fetchWeeklyRecap(range: WeekRange): Promise<WeeklyRecap> {
  const supabase = createClient();
  const startTs = new Date(`${range.start}T00:00:00`).toISOString();
  const endTs = new Date(`${range.end}T23:59:59`).toISOString();

  const nextStart = new Date(`${range.end}T00:00:00`);
  nextStart.setDate(nextStart.getDate() + 1);
  const nextEnd = new Date(nextStart);
  nextEnd.setDate(nextStart.getDate() + 6);

  const [events, pieces, payments, clients, prospects, activity, upcoming] = await Promise.all([
    supabase
      .from("events")
      .select("*, client:clients(*), content_pieces(*)")
      .gte("event_date", range.start)
      .lte("event_date", range.end)
      .order("event_date", { ascending: true }),
    supabase
      .from("content_pieces")
      .select("*, client:clients(*), editor:profiles(*)")
      .eq("status", "publicado")
      .gte("due_date", range.start)
      .lte("due_date", range.end)
      .order("due_date", { ascending: true }),
    supabase
      .from("client_payments")
      .select("*")
      .gte("due_date", range.start)
      .lte("due_date", range.end)
      .order("due_date", { ascending: true }),
    supabase.from("clients").select("id, name, paused, color"),
    supabase
      .from("prospects")
      .select("*")
      .gte("created_at", startTs)
      .lte("created_at", endTs)
      .order("created_at", { ascending: false }),
    supabase
      .from("prospect_activity")
      .select("id, prospect_id, note, created_at, prospect:prospects(name)")
      .gte("created_at", startTs)
      .lte("created_at", endTs)
      .order("created_at", { ascending: false }),
    supabase
      .from("events")
      .select("*, client:clients(*), content_pieces(*)")
      .gte("event_date", iso(nextStart))
      .lte("event_date", iso(nextEnd))
      .order("event_date", { ascending: true }),
  ]);

  for (const r of [events, pieces, payments, clients]) {
    if (r.error) throw r.error;
  }

  const clientList = (clients.data ?? []) as Client[];
  const clientById = new Map(clientList.map((c) => [c.id, c]));
  const isActive = (id?: string | null) => !id || !clientById.get(id)?.paused;

  const weekEvents = ((events.data ?? []) as CalendarEvent[]).filter((e) => isActive(e.client_id));

  const shot = new Map<string, { client: Client; pieces: number }>();
  for (const e of weekEvents) {
    if (e.event_type !== "grabacion" || !e.client_id) continue;
    const client = e.client ?? clientById.get(e.client_id);
    if (!client) continue;
    const cur = shot.get(client.id) ?? { client, pieces: 0 };
    cur.pieces += e.content_pieces?.length ?? 0;
    shot.set(client.id, cur);
  }

  return {
    range,
    events: weekEvents,
    publishedPieces: ((pieces.data ?? []) as ContentPiece[]).filter((p) => isActive(p.client_id)),
    shotClients: Array.from(shot.values()),
    payments: ((payments.data ?? []) as ClientPayment[])
      .filter((p) => isActive(p.client_id))
      .map((p) => ({ ...p, client: clientById.get(p.client_id) })),
    newProspects: (prospects.data ?? []) as Prospect[],
    prospectActivity: (activity.data ?? []) as unknown as ProspectActivityRow[],
    upcoming: ((upcoming.data ?? []) as CalendarEvent[]).filter((e) => isActive(e.client_id)),
  };
}
