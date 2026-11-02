import { createClient } from "@/lib/supabase/client";
import type { Billing, PackagePrices, PaidRecord } from "@/lib/billing";

export interface BillingData {
  /** false cuando las tablas aún no existen (migración sin aplicar). */
  available: boolean;
  billings: Billing[];
  records: PaidRecord[];
  prices: PackagePrices;
}

export const EMPTY_BILLING: BillingData = { available: false, billings: [], records: [], prices: {} };

// 42P01 = tabla inexistente en Postgres; PGRST205 = PostgREST no la encuentra en su caché de esquema.
function isMissingTable(err: { code?: string } | null): boolean {
  return err?.code === "42P01" || err?.code === "PGRST205";
}

export async function fetchBillingData(): Promise<BillingData> {
  const supabase = createClient();
  const [billings, records, prices] = await Promise.all([
    supabase.from("client_billing").select("client_id, pay_day, custom_price, start_period"),
    supabase.from("client_payment_months").select("client_id, period, amount"),
    supabase.from("package_prices").select("package, price"),
  ]);
  for (const r of [billings, records, prices]) {
    if (isMissingTable(r.error)) return EMPTY_BILLING;
    if (r.error) throw r.error;
  }
  return {
    available: true,
    billings: (billings.data ?? []).map((b) => ({
      ...b,
      pay_day: Number(b.pay_day),
      custom_price: b.custom_price == null ? null : Number(b.custom_price),
    })) as Billing[],
    records: (records.data ?? []).map((r) => ({ ...r, amount: r.amount == null ? null : Number(r.amount) })) as PaidRecord[],
    prices: Object.fromEntries((prices.data ?? []).map((p) => [p.package as string, Number(p.price)])),
  };
}

export async function saveBilling(input: {
  clientId: string;
  payDay: number;
  customPrice: number | null;
  startPeriod: string;
}): Promise<void> {
  const { error } = await createClient()
    .from("client_billing")
    .upsert(
      { client_id: input.clientId, pay_day: input.payDay, custom_price: input.customPrice, start_period: input.startPeriod },
      { onConflict: "client_id" }
    );
  if (error) throw error;
}

/** Marca un mes como pagado (guarda el monto de ese momento) o lo desmarca. */
export async function setPeriodPaid(clientId: string, period: string, paid: boolean, amount: number | null): Promise<void> {
  const table = createClient().from("client_payment_months");
  const { error } = paid
    ? await table.upsert({ client_id: clientId, period, amount, paid_at: new Date().toISOString() }, { onConflict: "client_id,period" })
    : await table.delete().eq("client_id", clientId).eq("period", period);
  if (error) throw error;
}

/** Guarda el precio de un paquete; null lo deja sin precio. */
export async function savePackagePrice(pkg: string, price: number | null): Promise<void> {
  const table = createClient().from("package_prices");
  const { error } =
    price == null ? await table.delete().eq("package", pkg) : await table.upsert({ package: pkg, price }, { onConflict: "package" });
  if (error) throw error;
}
