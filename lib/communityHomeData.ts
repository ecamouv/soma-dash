import { createClient } from "@/lib/supabase/client";
import type { PautaPost } from "@/lib/pauta";
import { addDaysISO } from "@/lib/opsHome";
import type { Client, ContentPiece } from "@/lib/types";

export interface CommunityHomeData {
  year: number;
  month: number; // 1-12
  /** Todos los clientes (incluidos pausados), por nombre, para que los colores coincidan con Clientes y Entregas. */
  clients: Client[];
  /** Piezas no publicadas, más las del mes actual (para el avance del mes). */
  pieces: ContentPiece[];
  /** Posts de pauta del mes, más los sin publicar con fecha en el horizonte (aunque sean de otro mes). */
  pautaPosts: PautaPost[];
}

export const QUEUE_HORIZON_DAYS = 7;

export async function fetchCommunityHome(todayISO: string): Promise<CommunityHomeData> {
  const supabase = createClient();
  const year = Number(todayISO.slice(0, 4));
  const month = Number(todayISO.slice(5, 7));
  const horizon = addDaysISO(todayISO, QUEUE_HORIZON_DAYS);

  const [clients, pieces, pauta] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase
      .from("content_pieces")
      .select("*, client:clients(*)")
      .or(`status.neq.publicado,month.eq.${month}`),
    supabase
      .from("pauta_posts")
      .select("*")
      .or(`and(year.eq.${year},month.eq.${month}),and(published.eq.false,scheduled_date.lte.${horizon})`),
  ]);
  for (const r of [clients, pieces, pauta]) {
    if (r.error) throw r.error;
  }

  return {
    year,
    month,
    clients: (clients.data ?? []) as Client[],
    pieces: (pieces.data ?? []) as ContentPiece[],
    pautaPosts: (pauta.data ?? []) as PautaPost[],
  };
}
