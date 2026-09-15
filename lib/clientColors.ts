// Paleta automática por defecto para clientes sin color asignado a mano (hex, en el
// mismo tono que usaba antes la paleta de Tailwind *-400). Compartida entre Clientes
// (para previsualizar el color por defecto en el picker) y Entregas (para pintar la
// franja/encabezado por cliente).
export const DEFAULT_CLIENT_COLORS = [
  "#60a5fa", // blue-400
  "#fb7185", // rose-400
  "#a78bfa", // violet-400
  "#fbbf24", // amber-400
  "#2dd4bf", // teal-400
  "#e879f9", // fuchsia-400
  "#fb923c", // orange-400
  "#22d3ee", // cyan-400
];

export function defaultClientColor(index: number): string {
  return DEFAULT_CLIENT_COLORS[index % DEFAULT_CLIENT_COLORS.length];
}

/** Hex (#rgb o #rrggbb) a rgba() con el alpha dado. Si el hex es inválido, cae a blanco. */
export function hexToRgba(hex: string, alpha: number): string {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const bigint = parseInt(clean, 16);
  if (clean.length !== 6 || Number.isNaN(bigint)) {
    return `rgba(255, 255, 255, ${alpha})`;
  }
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
