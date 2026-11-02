import { createClient } from "@/lib/supabase/client";
import type { PautaPost } from "@/lib/pauta";
import { EMPTY_BILLING, fetchBillingData, type BillingData } from "@/lib/billingData";
import { addDaysISO } from "@/lib/opsHome";
import type { CalendarEvent, Client, ContentPiece } from "@/lib/types";

export interface OpsHomeData {
  year: number;
  month: number; // 1-12
  // Todos los clientes (incluidos pausados), ordenados por nombre: así los colores
  // coinciden con los de Clientes y Entregas.
  clients: Client[];
  // Piezas no publicadas, más las del mes actual (para el avance del mes).
  pieces: ContentPiece[];
  billing: BillingData;
  // Juntas con cliente en los próximos 7 días.
  meetings: CalendarEvent[];
  pautaPosts: PautaPost[];
}

export const MEETINGS_HORIZON_DAYS = 7;

export async function fetchOpsHome(todayISO: string): Promise<OpsHomeData> {
  const supabase = createClient();
  const year = Number(todayISO.slice(0, 4));
  const month = Number(todayISO.slice(5, 7));

  const [clients, pieces, billing, meetings, pauta] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase
      .from("content_pieces")
      .select("*, client:clients(*)")
      .or(`status.neq.publicado,month.eq.${month}`),
    // Un fallo de cobro (p. ej. tablas sin migrar) no debe tumbar el resto de la home.
    fetchBillingData().catch((err) => {
      console.error("Error al cargar el cobro:", err);
      return EMPTY_BILLING;
    }),
    supabase
      .from("events")
      .select("*, client:clients(*)")
      .eq("event_type", "junta")
      .not("client_id", "is", null)
      .gte("event_date", todayISO)
      .lte("event_date", addDaysISO(todayISO, MEETINGS_HORIZON_DAYS))
      .order("event_date", { ascending: true })
      .order("event_time", { ascending: true }),
    supabase.from("pauta_posts").select("*").eq("year", year).eq("month", month),
  ]);

  for (const r of [clients, pieces, meetings, pauta]) {
    if (r.error) throw r.error;
  }

  return {
    year,
    month,
    clients: (clients.data ?? []) as Client[],
    pieces: (pieces.data ?? []) as ContentPiece[],
    billing,
    meetings: (meetings.data ?? []) as CalendarEvent[],
    pautaPosts: (pauta.data ?? []) as PautaPost[],
  };
}
