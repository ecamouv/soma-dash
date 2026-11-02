import { createClient } from "@/lib/supabase/client";
import { DEFAULT_PACKAGES, slugifyPackage, type PackageDef, type PackageMap } from "@/lib/packages";

export interface PackagesData {
  /** false cuando la tabla aún no existe (migración sin aplicar): se usan los paquetes originales. */
  available: boolean;
  packages: PackageMap;
}

export const FALLBACK_PACKAGES: PackagesData = { available: false, packages: DEFAULT_PACKAGES };

// 42P01 = tabla inexistente en Postgres; PGRST205 = PostgREST no la encuentra en su caché de esquema.
function isMissingTable(err: { code?: string } | null): boolean {
  return err?.code === "42P01" || err?.code === "PGRST205";
}

export async function fetchPackages(): Promise<PackagesData> {
  const { data, error } = await createClient()
    .from("packages")
    .select("value, label, reels, fotos, carruseles, pauta_posts_per_week")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (isMissingTable(error)) return FALLBACK_PACKAGES;
  if (error) throw error;
  const packages: PackageMap = {};
  for (const r of data ?? []) {
    packages[r.value as string] = {
      value: r.value as string,
      label: r.label as string,
      reels: Number(r.reels),
      fotos: Number(r.fotos),
      carruseles: Number(r.carruseles),
      pautaPerWeek: Number(r.pauta_posts_per_week),
    };
  }
  return { available: true, packages };
}

export interface NewPackageInput {
  label: string;
  reels: number;
  fotos: number;
  carruseles: number;
  pautaPerWeek: number;
  /** Precio mensual; null lo deja sin precio. */
  price: number | null;
}

/** Crea el paquete y, si trae precio, lo guarda en package_prices (que solo ven admin, dev y operaciones). */
export async function createPackage(input: NewPackageInput, existing: PackageMap): Promise<PackageDef> {
  const supabase = createClient();
  const value = slugifyPackage(input.label, Object.keys(existing));
  const { error } = await supabase.from("packages").insert({
    value,
    label: input.label.trim(),
    reels: input.reels,
    fotos: input.fotos,
    carruseles: input.carruseles,
    pauta_posts_per_week: input.pautaPerWeek,
    sort_order: Object.keys(existing).length + 1,
  });
  if (error) throw error;
  if (input.price != null) {
    const { error: priceError } = await supabase.from("package_prices").upsert({ package: value, price: input.price }, { onConflict: "package" });
    if (priceError) throw new Error(`El paquete se creó, pero no se pudo guardar el precio: ${priceError.message}`);
  }
  return {
    value,
    label: input.label.trim(),
    reels: input.reels,
    fotos: input.fotos,
    carruseles: input.carruseles,
    pautaPerWeek: input.pautaPerWeek,
  };
}
