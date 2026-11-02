// Helpers puros (sin Supabase ni React): se pueden probar con `npm test`.

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Fecha local YYYY-MM-DD (nunca toISOString: esa es UTC y en Hermosillo se adelanta un día desde las 17:00). */
export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Primer día del mes desplazado `n` meses. */
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Las 42 casillas (6 semanas, lunes a domingo) de la cuadrícula de un mes. */
export function buildGrid(month: Date): Date[] {
  const first = addMonths(month, 0);
  const offset = (first.getDay() + 6) % 7; // 0 = lunes
  return Array.from(
    { length: 42 },
    (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - offset + i)
  );
}

/**
 * ¿El mes `month` (1-12) va adelante de `ref`? Cubre el cruce diciembre -> enero; no
 * contempla saltos de año más largos porque piece.month no guarda año.
 */
export function isAheadOf(month: number, ref: number): boolean {
  return month > ref || (ref === 12 && month === 1);
}

/** Orden por fecha YYYY-MM-DD ascendente, las vacías al final. */
export function byDateNullsLast(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export function groupBy<T>(list: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const k = key(item);
    const group = map.get(k);
    if (group) group.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** Mensaje de cualquier error (los de Supabase no son instancias de Error). */
export function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return String(err);
}

/**
 * Los siguientes `count` números libres para "{mes}.{tipo}.{n}" (ej. "9.v.1").
 * Rellena huecos en vez de asumir que el máximo + 1 está libre.
 */
export function nextCodeNumbers(
  existingCodes: string[],
  type: "v" | "f",
  month: number,
  count: number
): number[] {
  const prefix = `${month}.${type}.`;
  const used = new Set(
    existingCodes.filter((c) => c.startsWith(prefix)).map((c) => parseInt(c.slice(prefix.length), 10))
  );
  const result: number[] = [];
  for (let n = 1; result.length < count; n++) if (!used.has(n)) result.push(n);
  return result;
}

export function buildPieceCode(month: number, type: "v" | "f", n: number): string {
  return `${month}.${type}.${n}`;
}

// Los posts de pauta se planean en máximo 4 semanas por mes (no hay semana 5).
export const MAX_PAUTA_WEEKS = 4;

/** Semanas (filas lunes-domingo) que toca un mes, con tope de MAX_PAUTA_WEEKS. month0 es 0-11. */
export function weeksInMonth(year: number, month0: number): number {
  const firstWeekday = (new Date(year, month0, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  return Math.min(Math.ceil((firstWeekday + daysInMonth) / 7), MAX_PAUTA_WEEKS);
}
