// Catálogo de paquetes de contenido. Los carruseles se cuentan aquí para referencia,
// pero por ahora NO se generan como content_pieces (se manejará a futuro).
// "solamente_pauta" no genera ninguna pieza (cliente de solo pauta paga, sin
// producción orgánica).
export type PackageValue = "1" | "2" | "3" | "solamente_pauta";

export interface PackageDef {
  value: PackageValue;
  label: string;
  reels: number;
  fotos: number;
  carruseles: number;
}

export const PACKAGES: Record<PackageValue, PackageDef> = {
  "1": { value: "1", label: "Paquete #1", reels: 4, fotos: 4, carruseles: 0 },
  "2": { value: "2", label: "Paquete #2", reels: 7, fotos: 6, carruseles: 1 },
  "3": { value: "3", label: "Paquete #3", reels: 10, fotos: 8, carruseles: 2 },
  solamente_pauta: { value: "solamente_pauta", label: "Solamente Pauta", reels: 0, fotos: 0, carruseles: 0 },
};

export const PACKAGE_LIST = Object.values(PACKAGES);
