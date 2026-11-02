import type { UserRole } from "@/lib/types";

// Secciones que cada rol no ve: se ocultan del sidebar y la página redirige a la home.
// Es solo de interfaz (igual que Inspiración para community): no restringe la API.
// Los datos de cobro sí están protegidos en la base de datos (ver can_manage_billing).
const BLOCKED: Partial<Record<UserRole, string[]>> = {
  prod: ["/paquetes"],
  editor: ["/paquetes"],
  community: ["/inspiracion", "/entregas", "/paquetes"],
  operaciones: ["/inspiracion", "/accesos"],
};

export function canAccess(role: UserRole | undefined, href: string): boolean {
  if (!role) return true;
  return !(BLOCKED[role] ?? []).includes(href);
}

/** Quién puede ver y editar precios, días de pago y pagos. Debe coincidir con can_manage_billing() en la base. */
export function canManageBilling(role: UserRole | undefined): boolean {
  return role === "admin" || role === "dev" || role === "operaciones";
}
