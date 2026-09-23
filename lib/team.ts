import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/lib/types";

export async function fetchTeam(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("profiles").select("*").order("full_name", { ascending: true });
  if (error) throw error;
  return data as Profile[];
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
