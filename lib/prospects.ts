import { createClient } from "@/lib/supabase/client";
import type { Profile, Prospect, ProspectActivity, ProspectInput } from "@/lib/types";

export async function fetchProspects(): Promise<Prospect[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Prospect[];
}

export async function fetchProfiles(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("profiles").select("*").order("full_name");
  if (error) throw error;
  return data as Profile[];
}

export async function createProspect(input: ProspectInput): Promise<Prospect> {
  const supabase = createClient();
  const { data, error } = await supabase.from("prospects").insert(input).select("*").single();
  if (error) throw error;
  return data as Prospect;
}

export async function updateProspect(id: string, patch: Partial<ProspectInput> & {
  converted_client_id?: string | null;
}): Promise<Prospect> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("prospects")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Prospect;
}

export async function deleteProspect(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("prospects").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchProspectActivity(prospectId: string): Promise<ProspectActivity[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("prospect_activity")
    .select("*, author:profiles(full_name, initials)")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as ProspectActivity[];
}

export async function addProspectActivity(prospectId: string, note: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("prospect_activity")
    .insert({ prospect_id: prospectId, note, created_by: user?.id ?? null });
  if (error) throw error;
}

/** Normaliza un handle o URL de red social a un link abrible. */
export function socialUrl(kind: "instagram" | "facebook" | "tiktok" | "website", value?: string | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  switch (kind) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://tiktok.com/@${handle}`;
    case "facebook":
      return `https://facebook.com/${handle}`;
    default:
      return `https://${v}`;
  }
}
