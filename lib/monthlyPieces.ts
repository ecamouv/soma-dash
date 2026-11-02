import type { PackageMap } from "./packages.ts";
import { buildPieceCode, nextCodeNumbers } from "./utils.ts";

interface ClientRow {
  id: string;
  package: string | null;
  paused: boolean | null;
}

interface PieceRow {
  client_id: string;
  code: string;
  type: "v" | "f";
}

/**
 * Piezas que faltan para que cada cliente activo llegue a la cuota de su paquete en
 * `month`. `pieces` son las piezas ya existentes de ese mes (incluye las adelantadas),
 * así que correrlo dos veces no duplica nada.
 */
export function missingPieceRows(clients: ClientRow[], pieces: PieceRow[], month: number, packages: PackageMap) {
  return clients
    .filter((c) => !c.paused && c.package && c.package in packages)
    .flatMap((c) => {
      const pkg = packages[c.package as string];
      const own = pieces.filter((p) => p.client_id === c.id);
      return (["v", "f"] as const).flatMap((type) => {
        const quota = type === "v" ? pkg.reels : pkg.fotos;
        const missing = Math.max(0, quota - own.filter((p) => p.type === type).length);
        return nextCodeNumbers(own.map((p) => p.code), type, month, missing).map((n) => ({
          client_id: c.id,
          code: buildPieceCode(month, type, n),
          type,
          month,
        }));
      });
    });
}
