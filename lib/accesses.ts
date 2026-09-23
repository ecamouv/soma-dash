import { createClient } from "@/lib/supabase/client";

export interface WebAccess {
  id: string;
  name: string;
  url?: string | null;
  section: string;
  email?: string | null;
  // Solo indica dónde consultar la contraseña (ej. "Notion"). Nunca la contraseña.
  password_note?: string | null;
  notes?: string | null;
  favorite: boolean;
  created_at: string;
}

export type WebAccessInput = Omit<WebAccess, "id" | "created_at">;

export async function fetchWebAccesses(): Promise<WebAccess[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("web_accesses")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as WebAccess[];
}

export async function createWebAccess(input: WebAccessInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("web_accesses").insert(input);
  if (error) throw error;
}

export async function updateWebAccess(id: string, patch: Partial<WebAccessInput>): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("web_accesses").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteWebAccess(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("web_accesses").delete().eq("id", id);
  if (error) throw error;
}

export function normalizeUrl(url?: string | null): string | null {
  const v = url?.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

// Paleta de pills por sección: color estable según el nombre.
const SECTION_COLORS = [
  { bg: "#3182CE1A", fg: "#2B6CB0" },
  { bg: "#38A1691A", fg: "#276749" },
  { bg: "#805AD51A", fg: "#6B46C1" },
  { bg: "#E53E3E1A", fg: "#C53030" },
  { bg: "#DD6B201A", fg: "#C05621" },
  { bg: "#3197951A", fg: "#2C7A7B" },
  { bg: "#D53F8C1A", fg: "#B83280" },
  { bg: "#71809633", fg: "#4A5568" },
];

export function sectionColor(section: string) {
  let h = 0;
  for (const ch of section.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SECTION_COLORS[h % SECTION_COLORS.length];
}
