// Paquetes de contenido. Viven en la tabla `packages` (editable desde la página Paquetes);
// DEFAULT_PACKAGES son los cinco originales y se usan solo si la tabla aún no existe.
// Los carruseles se cuentan aquí para referencia, pero por ahora NO se generan como
// content_pieces (se manejará a futuro). Un paquete sin reels ni fotos no genera piezas.

export type PackageValue = string;

export interface PackageDef {
  value: PackageValue;
  label: string;
  reels: number;
  fotos: number;
  carruseles: number;
  /** Posts de pauta por semana: valor inicial en Publicaciones para un cliente sin ajuste propio. */
  pautaPerWeek: number;
}

export type PackageMap = Record<PackageValue, PackageDef>;

const def = (value: string, label: string, reels: number, fotos: number, carruseles: number): PackageDef => ({
  value,
  label,
  reels,
  fotos,
  carruseles,
  pautaPerWeek: 0,
});

export const DEFAULT_PACKAGES: PackageMap = {
  "1": def("1", "Paquete #1", 4, 4, 0),
  "2": def("2", "Paquete #2", 7, 6, 1),
  "3": def("3", "Paquete #3", 10, 8, 2),
  "6_videos": def("6_videos", "Paquete 6 Videos", 6, 0, 0),
  solamente_pauta: def("solamente_pauta", "Solamente Pauta", 0, 0, 0),
};

/** Paquetes en el orden en que se guardaron (los objetos conservan el orden de inserción). */
export function packageList(packages: PackageMap): PackageDef[] {
  return Object.values(packages);
}

/** Clave estable a partir del nombre: "Paquete Premium" -> "paquete_premium"; añade _2, _3... si ya existe. */
export function slugifyPackage(label: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "paquete";
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}_${n}`;
  return slug;
}

/** Resumen corto de lo que incluye: "4 reels · 4 fotos · 2 posts de pauta/sem". */
export function packageSummary(p: PackageDef): string {
  const parts: string[] = [];
  if (p.reels) parts.push(`${p.reels} reels`);
  if (p.fotos) parts.push(`${p.fotos} fotos`);
  if (p.carruseles) parts.push(`${p.carruseles} ${p.carruseles === 1 ? "carrusel" : "carruseles"}`);
  if (p.pautaPerWeek) parts.push(`${p.pautaPerWeek} ${p.pautaPerWeek === 1 ? "post" : "posts"} de pauta/sem`);
  return parts.length > 0 ? parts.join(" · ") : "Sin contenido incluido";
}
