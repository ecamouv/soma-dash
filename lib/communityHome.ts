// Lógica pura de la home de Community Manager (sin React ni Supabase) para probarla con node --test.
import type { ContentPiece, PieceStatus } from "@/lib/types";
import type { PautaPost } from "@/lib/pauta";
import { addDaysISO, pieceName } from "./opsHome.ts";

export const STATUS_LABEL: Record<PieceStatus, string> = {
  por_grabar: "Por grabar",
  en_edicion: "En edición",
  revision: "En revisión",
  aprobado: "Aprobada",
  publicado: "Publicada",
};

export interface QueueRow {
  key: string;
  kind: "piece" | "post";
  id: string;
  name: string;
  clientId: string;
  /** Fecha en que debe salir (YYYY-MM-DD). */
  date: string;
  /** Las piezas llevan su status; los posts de pauta no tienen etapa de producción. */
  status: PieceStatus | "post";
  /** Se puede marcar como publicado: piezas solo cuando ya están aprobadas; posts siempre. */
  publishable: boolean;
}

/**
 * Lo que sigue por publicar: piezas y posts de pauta sin publicar con fecha hasta `horizonDays`
 * días adelante, incluyendo todo lo atrasado. Ordenado por fecha. Los clientes ya vienen filtrados
 * (pausados fuera) en `pieces` y `posts`.
 */
export function publishQueue(
  pieces: ContentPiece[],
  posts: PautaPost[],
  todayISO: string,
  horizonDays = 7
): QueueRow[] {
  const endISO = addDaysISO(todayISO, horizonDays);
  const rows: QueueRow[] = [];
  for (const p of pieces) {
    const date = p.due_date?.slice(0, 10);
    if (p.status === "publicado" || !date || date > endISO) continue;
    rows.push({
      key: `piece:${p.id}`,
      kind: "piece",
      id: p.id,
      name: pieceName(p),
      clientId: p.client_id,
      date,
      status: p.status,
      publishable: p.status === "aprobado",
    });
  }
  for (const post of posts) {
    const date = post.scheduled_date?.slice(0, 10);
    if (post.published || !date || date > endISO) continue;
    rows.push({
      key: `post:${post.id}`,
      kind: "post",
      id: post.id,
      name: post.name,
      clientId: post.client_id,
      date,
      status: "post",
      publishable: true,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/**
 * Piezas que salen hoy, mañana o ya se pasaron y todavía no están aprobadas
 * (por grabar, en edición o en revisión): no van a estar listas a tiempo sin intervención.
 */
export function atRisk(queue: QueueRow[], todayISO: string): QueueRow[] {
  const limit = addDaysISO(todayISO, 1);
  return queue.filter((r) => r.kind === "piece" && r.status !== "aprobado" && r.date <= limit);
}

export interface PendingPautaGroup {
  clientId: string;
  count: number;
}

/** Posts del mes que aún no tienen fecha ni están publicados, por cliente. `maxWeek` oculta la semana 5 como Publicaciones. */
export function unscheduledPauta(
  posts: PautaPost[],
  year: number,
  month: number,
  maxWeek: number
): PendingPautaGroup[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    if (p.year !== year || p.month !== month || p.week > maxWeek) continue;
    if (p.published || p.scheduled_date) continue;
    counts.set(p.client_id, (counts.get(p.client_id) ?? 0) + 1);
  }
  return [...counts].map(([clientId, count]) => ({ clientId, count }));
}
