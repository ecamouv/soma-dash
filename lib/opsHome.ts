// Lógica pura de la home de Operaciones (sin React ni Supabase) para poder probarla con node --test.
import type { ContentPiece } from "@/lib/types";
import type { PautaPost } from "@/lib/pauta";

const pad = (n: number) => String(n).padStart(2, "0");

/** Suma días a una fecha YYYY-MM-DD (hora local, sin pasar por UTC). */
export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function pieceName(p: Pick<ContentPiece, "code" | "display_name">): string {
  return p.display_name?.trim() || p.code;
}

// ---------------------------------------------------------------- En revisión

export interface RevisionGroup {
  clientId: string;
  clientName: string;
  pieces: ContentPiece[];
}

export function revisionGroups(pieces: ContentPiece[]): RevisionGroup[] {
  const map = new Map<string, RevisionGroup>();
  for (const p of pieces) {
    if (p.status !== "revision") continue;
    const group = map.get(p.client_id) ?? {
      clientId: p.client_id,
      clientName: p.client?.name ?? "Sin cliente",
      pieces: [],
    };
    group.pieces.push(p);
    map.set(p.client_id, group);
  }
  const dueKey = (p: ContentPiece) => p.due_date?.slice(0, 10) ?? "9999-99-99";
  const groups = [...map.values()];
  for (const g of groups) g.pieces.sort((a, b) => dueKey(a).localeCompare(dueKey(b)) || a.code.localeCompare(b.code));
  return groups.sort(
    (a, b) => dueKey(a.pieces[0]).localeCompare(dueKey(b.pieces[0])) || a.clientName.localeCompare(b.clientName)
  );
}

// ---------------------------------------------------------------- Avance del mes

export interface Quota {
  done: number;
  total: number;
}

/**
 * Reels (type "v") y fotos (type "f") publicados del mes. El total es la cuota del paquete
 * (`quota`), no las piezas que existan; sin paquete se usa el número de piezas del mes.
 * `done` puede pasar del total si se publicó más de lo que incluye el paquete.
 */
export function monthProgress(
  pieces: ContentPiece[],
  clientId: string,
  month: number,
  quota?: { reels: number; fotos: number }
): { reels: Quota; fotos: Quota } {
  const reels: Quota = { done: 0, total: 0 };
  const fotos: Quota = { done: 0, total: 0 };
  for (const p of pieces) {
    if (p.client_id !== clientId || p.month !== month) continue;
    const q = p.type === "v" ? reels : fotos;
    q.total += 1;
    if (p.status === "publicado") q.done += 1;
  }
  if (quota) {
    reels.total = quota.reels;
    fotos.total = quota.fotos;
  }
  return { reels, fotos };
}

/**
 * Posts de pauta publicados / total del mes. `maxWeek` es el tope de semanas que muestra
 * Publicaciones (weeksInMonth): los posts guardados en semanas posteriores ahí no se ven,
 * así que tampoco cuentan aquí.
 */
export function pautaProgress(
  posts: PautaPost[],
  clientId: string,
  year: number,
  month: number,
  maxWeek: number
): Quota {
  const q: Quota = { done: 0, total: 0 };
  for (const post of posts) {
    if (post.client_id !== clientId || post.year !== year || post.month !== month) continue;
    if (post.week > maxWeek) continue;
    q.total += 1;
    if (post.published) q.done += 1;
  }
  return q;
}

// ---------------------------------------------------------------- Formato

/** Iniciales para el avatar de un cliente: primera letra de las dos primeras palabras. */
export function initialsOf(name: string): string {
  const words = name.split(/[\s/]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export function formatMXN(n: number | null | undefined): string {
  return n == null ? "" : MXN.format(n);
}

export function formatShort(dateISO: string): string {
  return new Date(`${dateISO.slice(0, 10)}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

/** "Hoy", "Mañana" o "mié 5". */
export function formatDay(dateISO: string, todayISO: string): string {
  if (dateISO === todayISO) return "Hoy";
  if (dateISO === addDaysISO(todayISO, 1)) return "Mañana";
  return new Date(`${dateISO.slice(0, 10)}T00:00:00`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric" });
}
