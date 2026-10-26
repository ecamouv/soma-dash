import { createClient } from "@/lib/supabase/client";
import { normalizeUrl } from "@/lib/accesses";

export type InspirationPlatform = "youtube" | "tiktok" | "instagram" | "otro";

export const PLATFORM_LABEL: Record<InspirationPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  otro: "Link",
};

export const SECTORS = [
  "Restaurante",
  "Ropa",
  "Creativo",
  "Belleza",
  "Fitness",
  "Salud",
  "Tecnología",
  "Inmobiliaria",
  "Educación",
  "Otro",
];

export interface InspirationItem {
  id: string;
  url: string;
  platform: InspirationPlatform;
  title: string | null;
  thumbnail_url: string | null;
  client_id: string | null;
  sector: string | null;
  created_at: string;
  client?: { name: string } | null;
}

export async function fetchInspiration(): Promise<InspirationItem[]> {
  const { data, error } = await createClient()
    .from("inspiration")
    .select("*, client:clients(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InspirationItem[];
}

interface Preview {
  platform: InspirationPlatform;
  title: string | null;
  thumbnail_url: string | null;
  url: string;
}

/** Guarda un link: primero pide plataforma, título y miniatura al servidor; si eso falla, guarda el link igual. */
export async function addInspiration(input: {
  url: string;
  title?: string;
  clientId?: string | null;
  sector?: string | null;
}): Promise<void> {
  const supabase = createClient();
  let preview: Preview = {
    platform: "otro",
    title: null,
    thumbnail_url: null,
    url: normalizeUrl(input.url) ?? input.url,
  };
  try {
    const res = await fetch(`/api/preview?url=${encodeURIComponent(input.url)}`);
    if (res.ok) preview = (await res.json()) as Preview;
  } catch {
    // se guarda sin miniatura
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("inspiration").insert({
    url: preview.url,
    platform: preview.platform,
    title: input.title?.trim() || preview.title,
    thumbnail_url: preview.thumbnail_url,
    client_id: input.clientId || null,
    sector: input.sector || null,
    added_by: user?.id ?? null,
  });
  if (error) throw error;
}

export async function deleteInspiration(id: string): Promise<void> {
  const { error } = await createClient().from("inspiration").delete().eq("id", id);
  if (error) throw error;
}

/** Cambia el cliente y/o el sector de una referencia ya guardada. */
export async function updateInspiration(
  id: string,
  patch: { client_id?: string | null; sector?: string | null }
): Promise<void> {
  const { error } = await createClient().from("inspiration").update(patch).eq("id", id);
  if (error) throw error;
}
