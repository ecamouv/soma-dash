import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types";

// Cuentas que no se muestran en la lista de equipo.
const HIDDEN_TEAM_EMAILS = ["dev@somamedia.com.mx"];

/** Cuentas dev: solo se ven en la página de Equipo (y dev@somamedia.com.mx ni ahí). */
export function isDevProfile(p: Pick<Profile, "role" | "email">): boolean {
  return p.role === "dev" || HIDDEN_TEAM_EMAILS.includes((p.email ?? "").toLowerCase());
}

/** Quita las cuentas dev de cualquier lista de personas fuera de la página de Equipo. */
export function withoutDevs<T extends Pick<Profile, "role" | "email">>(list: T[]): T[] {
  return list.filter((p) => !isDevProfile(p));
}

export async function fetchTeam(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("profiles").select("*").order("full_name", { ascending: true });
  if (error) throw error;
  return (data as Profile[]).filter((p) => !HIDDEN_TEAM_EMAILS.includes((p.email ?? "").toLowerCase()));
}

export async function addTeamMember(input: { fullName: string; email: string; role: UserRole }): Promise<void> {
  const res = await fetch("/api/team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "No se pudo agregar al integrante.");
}

export async function deleteTeamMember(userId: string): Promise<void> {
  const res = await fetch("/api/team", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "No se pudo eliminar al integrante.");
}
