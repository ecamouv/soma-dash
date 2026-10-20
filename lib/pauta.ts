import { createClient } from "@/lib/supabase/client";

export interface PautaPost {
  id: string;
  client_id: string;
  year: number;
  month: number; // 1-12
  week: number; // 1..n, filas lunes-domingo del calendario mensual
  slot: number; // 1..posts_per_week dentro de la semana
  name: string;
  scheduled_date: string | null;
  published: boolean;
}

// Los posts de pauta se planean en máximo 4 semanas por mes (no hay semana 5).
export const MAX_PAUTA_WEEKS = 4;

/** Cantidad de semanas (filas lunes-domingo) que toca un mes, con tope de MAX_PAUTA_WEEKS. month0 es 0-11. */
export function weeksInMonth(year: number, month0: number): number {
  const firstWeekday = (new Date(year, month0, 1).getDay() + 6) % 7; // 0 = lunes
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  return Math.min(Math.ceil((firstWeekday + daysInMonth) / 7), MAX_PAUTA_WEEKS);
}

/** Nombre automático: se entiende solo, sin necesidad de editarlo. */
export function genericPostName(week: number, slot: number): string {
  return `Semana ${week} · Post ${slot}`;
}

function isPristine(post: PautaPost): boolean {
  return !post.published && !post.scheduled_date && post.name === genericPostName(post.week, post.slot);
}

export async function fetchPautaSettings(): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("pauta_settings").select("client_id, posts_per_week");
  if (error) throw error;
  const map: Record<string, number> = {};
  for (const row of data ?? []) map[row.client_id as string] = row.posts_per_week as number;
  return map;
}

export async function savePostsPerWeek(clientId: string, postsPerWeek: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("pauta_settings")
    .upsert({ client_id: clientId, posts_per_week: postsPerWeek }, { onConflict: "client_id" });
  if (error) throw error;
}

/**
 * Posts del mes (year/month) más los que tienen fecha dentro del rango visible del
 * calendario (rangeStart..rangeEnd, YYYY-MM-DD), para que el calendario también muestre
 * los posts de otro mes cuya fecha cae en las celdas de relleno de esta cuadrícula.
 */
export async function fetchPautaPosts(
  year: number,
  month: number,
  rangeStart: string,
  rangeEnd: string
): Promise<PautaPost[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pauta_posts")
    .select("*")
    .or(
      `and(year.eq.${year},month.eq.${month}),and(scheduled_date.gte.${rangeStart},scheduled_date.lte.${rangeEnd})`
    )
    .order("week", { ascending: true })
    .order("slot", { ascending: true });
  if (error) throw error;
  return data as PautaPost[];
}

/** Cuántos posts faltan para que el mes tenga `perWeek` posts en cada semana. */
export function missingPostCount(existing: PautaPost[], perWeek: number, weeks: number): number {
  const have = new Set(existing.map((p) => `${p.week}:${p.slot}`));
  let missing = 0;
  for (let w = 1; w <= weeks; w++) {
    for (let s = 1; s <= perWeek; s++) if (!have.has(`${w}:${s}`)) missing++;
  }
  return missing;
}

/**
 * Deja el mes con `perWeek` posts por semana: crea los que faltan con nombre
 * genérico y sin fecha, y quita los sobrantes solo si siguen intactos (sin fecha,
 * sin checkmark y con el nombre original). Lo que el usuario ya tocó no se borra.
 */
export async function syncPautaMonth(
  clientId: string,
  year: number,
  month: number,
  perWeek: number,
  existing: PautaPost[]
): Promise<void> {
  const supabase = createClient();
  const weeks = weeksInMonth(year, month - 1);
  const have = new Set(existing.map((p) => `${p.week}:${p.slot}`));

  const toInsert = [];
  for (let w = 1; w <= weeks; w++) {
    for (let s = 1; s <= perWeek; s++) {
      if (have.has(`${w}:${s}`)) continue;
      toInsert.push({
        client_id: clientId,
        year,
        month,
        week: w,
        slot: s,
        name: genericPostName(w, s),
      });
    }
  }
  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("pauta_posts")
      .upsert(toInsert, { onConflict: "client_id,year,month,week,slot", ignoreDuplicates: true });
    if (error) throw error;
  }

  const removable = existing.filter((p) => p.slot > perWeek && isPristine(p)).map((p) => p.id);
  if (removable.length > 0) {
    const { error } = await supabase.from("pauta_posts").delete().in("id", removable);
    if (error) throw error;
  }
}

export async function updatePautaPost(
  id: string,
  patch: Partial<Pick<PautaPost, "name" | "scheduled_date" | "published">>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("pauta_posts").update(patch).eq("id", id);
  if (error) throw error;
}
