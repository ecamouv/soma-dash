import { createClient } from "@/lib/supabase/client";
import type { ContentPiece, PieceStatus } from "@/lib/types";

const supabase = createClient();

export interface UpdatePiecePayload {
  pieceId: string;
  dueDate?: string | null;
  displayName?: string | null;
  month?: number;
  editorId?: string | null;
  status?: PieceStatus;
  script?: string | null;
  metaUrl?: string | null;
}

export interface CreatePiecePayload {
  clientId: string;
  code: string;
  type: "v" | "f";
  month: number;
  dueDate?: string | null;
  displayName?: string | null;
  editorId?: string | null;
  status?: PieceStatus;
  script?: string | null;
  metaUrl?: string | null;
}

/**
 * Obtener todas las piezas de contenido con sus relaciones de Cliente y Editor
 */
export async function fetchContentPieces(): Promise<ContentPiece[]> {
  const { data, error } = await supabase
    .from("content_pieces")
    .select("*, client:clients(*), editor:profiles(*)")
    .order("code", { ascending: true });
  if (error) throw error;
  return (data as ContentPiece[]) || [];
}

/**
 * Actualizar una pieza: solo los campos que vengan definidos. El mes NO regenera el
 * code -- el code se queda fijo desde que se crea la pieza. Pipeline de status:
 * por_grabar -> en_edicion -> revision -> aprobado (desde Entregas) -> publicado
 * (desde Publicaciones).
 */
export async function updateContentPiece({
  pieceId,
  dueDate,
  displayName,
  month,
  editorId,
  status,
  script,
  metaUrl,
}: UpdatePiecePayload): Promise<ContentPiece> {
  const fields = {
    due_date: dueDate,
    display_name: displayName,
    month,
    editor_id: editorId,
    status,
    script,
    meta_url: metaUrl,
  };
  const updateData = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

  const { data, error } = await supabase
    .from("content_pieces")
    .update(updateData)
    .eq("id", pieceId)
    .select("*, client:clients(*), editor:profiles(*)")
    .single();
  if (error) throw error;
  return data as ContentPiece;
}

/**
 * Crear una nueva pieza de contenido manualmente para un cliente
 */
export async function createContentPiece(payload: CreatePiecePayload): Promise<ContentPiece> {
  const { data, error } = await supabase
    .from("content_pieces")
    .insert({
      client_id: payload.clientId,
      code: payload.code,
      type: payload.type,
      month: payload.month,
      due_date: payload.dueDate || null,
      display_name: payload.displayName || null,
      editor_id: payload.editorId || null,
      status: payload.status || "por_grabar",
      script: payload.script || null,
      meta_url: payload.metaUrl || null,
    })
    .select("*, client:clients(*), editor:profiles(*)")
    .single();
  if (error) throw error;
  return data as ContentPiece;
}

/**
 * Busca una pieza "en blanco" para un cliente+mes+tipo -- sin fecha, sin evento, sin
 * nombre, sin guión/link, status todavía "por_grabar" -- exactamente lo que genera el
 * paquete al crear un cliente (ver createClientWithPackage). Si existe, la borra.
 *
 * Se usa al crear una pieza individual "adelantada" que pertenece a un mes futuro: en
 * vez de que el total de ese mes quede duplicado, se consume un cupo en blanco ya
 * generado por el paquete. Si no hay ninguna pieza en blanco disponible, no borra nada
 * -- nunca resta de una pieza que ya tiene información capturada.
 */
export async function consumeBlankPlaceholder(
  clientId: string,
  month: number,
  type: "v" | "f"
): Promise<void> {
  const { data, error } = await supabase
    .from("content_pieces")
    .select("id")
    .eq("client_id", clientId)
    .eq("month", month)
    .eq("type", type)
    .eq("status", "por_grabar")
    .is("due_date", null)
    .is("event_id", null)
    .is("display_name", null)
    .is("script", null)
    .is("meta_url", null)
    .is("editor_id", null)
    .limit(1);

  if (error) {
    console.error("Error al buscar cupo en blanco:", error);
    return;
  }
  if (data && data.length > 0) {
    const { error: deleteError } = await supabase.from("content_pieces").delete().eq("id", data[0].id);
    if (deleteError) console.error("Error al consumir cupo en blanco:", deleteError);
  }
}

/** Borrar una pieza de contenido (desde el modal de edición en Entregas). */
export async function deleteContentPiece(pieceId: string): Promise<void> {
  const { error } = await supabase.from("content_pieces").delete().eq("id", pieceId);
  if (error) throw error;
}
