// Lógica pura del cobro mensual (sin React ni Supabase) para poder probarla con node --test.
// Un "periodo" es un mes con formato YYYY-MM.

export interface Billing {
  client_id: string;
  pay_day: number;
  custom_price: number | null;
  start_period: string;
}

export interface PaidRecord {
  client_id: string;
  period: string;
  amount: number | null;
}

/** Precio mensual por valor de paquete ("1", "2", "3", "6_videos", "solamente_pauta"). */
export type PackagePrices = Record<string, number>;

export interface BillLine {
  clientId: string;
  period: string;
  /** Fecha de pago del mes (el día elegido, o el último día si el mes es más corto). */
  dueDate: string;
  /** null cuando no hay precio personalizado ni precio de paquete. */
  amount: number | null;
  paid: boolean;
}

const MAX_PERIODS = 120;

export function periodOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function addPeriods(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** Todos los periodos de `start` a `end`, ambos incluidos. */
export function periodsFrom(start: string, end: string): string[] {
  const out: string[] = [];
  for (let p = start; p <= end && out.length < MAX_PERIODS; p = addPeriods(p, 1)) out.push(p);
  return out;
}

/** Fecha de pago de un periodo: el día elegido, recortado al último día del mes (31 en febrero, etc.). */
export function dueDateFor(period: string, payDay: number): string {
  const [y, m] = period.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.min(Math.max(1, Math.trunc(payDay)), lastDay);
  return `${period}-${String(day).padStart(2, "0")}`;
}

/** "Septiembre de 2026". */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const text = new Date(y, m - 1, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Cuota mensual del cliente: su precio personalizado si tiene, si no el de su paquete. */
export function feeFor(
  billing: Pick<Billing, "custom_price"> | undefined | null,
  pkg: string | null | undefined,
  prices: PackagePrices
): number | null {
  if (billing?.custom_price != null) return Number(billing.custom_price);
  if (pkg && prices[pkg] != null) return Number(prices[pkg]);
  return null;
}

export interface BillingClient {
  id: string;
  package?: string | null;
  paused?: boolean;
}

/**
 * Renglones de cobro: `current` es el mes en curso de cada cliente con cobro configurado y
 * `overdue` cada mes anterior (desde start_period) que nunca se marcó como pagado.
 * Clientes pausados o con start_period futuro no generan nada.
 */
export function buildLines(input: {
  clients: BillingClient[];
  billings: Billing[];
  records: PaidRecord[];
  prices: PackagePrices;
  todayISO: string;
}): { current: BillLine[]; overdue: BillLine[] } {
  const { clients, billings, records, prices, todayISO } = input;
  const currentPeriod = periodOf(todayISO);
  const lastPeriod = addPeriods(currentPeriod, -1);
  const billingByClient = new Map(billings.map((b) => [b.client_id, b]));
  const paid = new Map(records.map((r) => [`${r.client_id}|${r.period}`, r]));

  const current: BillLine[] = [];
  const overdue: BillLine[] = [];

  for (const client of clients) {
    const billing = billingByClient.get(client.id);
    if (!billing || client.paused) continue;
    const fee = feeFor(billing, client.package, prices);
    const lineFor = (period: string): BillLine => {
      const record = paid.get(`${client.id}|${period}`);
      return {
        clientId: client.id,
        period,
        dueDate: dueDateFor(period, billing.pay_day),
        amount: record?.amount != null ? Number(record.amount) : fee,
        paid: !!record,
      };
    };

    if (billing.start_period <= currentPeriod) current.push(lineFor(currentPeriod));
    for (const period of periodsFrom(billing.start_period, lastPeriod)) {
      const line = lineFor(period);
      if (!line.paid) overdue.push(line);
    }
  }

  const byDue = (a: BillLine, b: BillLine) => a.dueDate.localeCompare(b.dueDate) || a.clientId.localeCompare(b.clientId);
  return { current: current.sort(byDue), overdue: overdue.sort(byDue) };
}

/** Fechas de pago de un cliente para mostrar en su calendario público: `from` y los `count` meses siguientes. */
export function payDatesFor(billing: Pick<Billing, "pay_day" | "start_period">, from: string, count: number): string[] {
  return periodsFrom(from, addPeriods(from, count))
    .filter((p) => p >= billing.start_period)
    .map((p) => dueDateFor(p, billing.pay_day));
}
