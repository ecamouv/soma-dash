import { createClient } from "@/lib/supabase/client";
import type { ContentPiece, PieceStatus } from "@/lib/types";

const supabase = createClient();

export interface UpdatePiecePayload {
  pieceId: string;
  dueDate?: string | null;
  displayName?: string | null;
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
  editorId?: string | null;
  status?: PieceStatus;
  script?: string | null;
  metaUrl?: string | null;
}

/**
 * Calcular los siguientes N números libres de código para un cliente+tipo+mes,
 * siguiendo el patrón existente "{mes}.{tipo}.{n}" (ej. "9.v.1"). Rellena huecos
 * si los hay, en vez de asumir que el máximo actual + 1 está libre.
 */
export function nextCodeNumbers(
  existingCodes: string[],
  type: "v" | "f",
  month: number,
  count: number
): number[] {
  const prefix = `${month}.${type}.`;
  const used = new Set(
    existingCodes
      .filter((c) => c.startsWith(prefix))
      .map((c) => parseInt(c.slice(prefix.length), 10))
      .filter((n) => !Number.isNaN(n))
  );

  const result: number[] = [];
  let n = 1;
  while (result.length < count) {
    if (!used.has(n)) {
      result.push(n);
      used.add(n);
    }
    n++;
  }
  return result;
}

export function buildPieceCode(month: number, type: "v" | "f", n: number): string {
  return `${month}.${type}.${n}`;
}

/**
 * Obtener todas las piezas de contenido con sus relaciones de Cliente y Editor
 */
export async function fetchContentPieces(): Promise<ContentPiece[]> {
  const { data, error } = await supabase
    .from("content_pieces")
    .select("*, client:clients(*), editor:profiles(*)")
    .order("code", { ascending: true });

  if (error) {
    console.error("Error al obtener piezas de contenido:", error);
    throw error;
  }

  return (data as ContentPiece[]) || [];
}

/**
 * Actualizar una pieza de contenido (Fecha de entrega, Editor, Estado, Guión, Link de Meta)
 */
export async function updateContentPiece({
  pieceId,
  dueDate,
  displayName,
  editorId,
  status,
  script,
  metaUrl,
}: UpdatePiecePayload): Promise<ContentPiece> {
  const updateData: Record<string, any> = {};

  if (dueDate !== undefined) updateData.due_date = dueDate;
  if (displayName !== undefined) updateData.display_name = displayName;
  if (editorId !== undefined) updateData.editor_id = editorId;
  if (status !== undefined) updateData.status = status;
  if (script !== undefined) updateData.script = script;
  if (metaUrl !== undefined) updateData.meta_url = metaUrl;

  const { data, error } = await supabase
    .from("content_pieces")
    .update(updateData)
    .eq("id", pieceId)
    .select("*, client:clients(*), editor:profiles(*)")
    .single();

  if (error) {
    console.error(`Error al actualizar la pieza ${pieceId}:`, error);
    throw error;
  }

  return data as ContentPiece;
}

/**
 * Crear una nueva pieza de contenido manualmente para un cliente
 */
export async function createContentPiece(
  payload: CreatePiecePayload
): Promise<ContentPiece> {
  const { data, error } = await supabase
    .from("content_pieces")
    .insert({
      client_id: payload.clientId,
      code: payload.code,
      type: payload.type,
      month: payload.month,
      due_date: payload.dueDate || null,
      editor_id: payload.editorId || null,
      status: payload.status || "por_grabar",
      script: payload.script || null,
      meta_url: payload.metaUrl || null,
    })
    .select("*, client:clients(*), editor:profiles(*)")
    .single();

  if (error) {
    console.error("Error al crear la pieza de contenido:", error);
    throw error;
  }

  return data as ContentPiece;
}

/**
 * Reagendar rápidamente la fecha de entrega de una pieza
 */
export async function reschedulePieceDate(
  pieceId: string,
  newDueDate: string | null
): Promise<ContentPiece> {
  return updateContentPiece({
    pieceId,
    dueDate: newDueDate,
  });
}

/**
 * Guardar la fecha de entrega y el display name de una pieza desde el modal
 * de edición (ambos opcionales, se guardan juntos con un solo "Guardar").
 */
export async function updatePieceDueDateAndName(
  pieceId: string,
  dueDate: string | null,
  displayName: string | null
): Promise<ContentPiece> {
  return updateContentPiece({
    pieceId,
    dueDate,
    displayName,
  });
}

/**
 * Cambiar manualmente el estado de una pieza. Pipeline completo:
 * por_grabar -> en_edicion -> revision -> aprobado -> publicado.
 * Las primeras cuatro etapas se mueven desde Entregas; 'publicado' se marca
 * desde Publicaciones (checkbox en la vista mensual).
 */
export async function updatePieceStatus(
  pieceId: string,
  newStatus: PieceStatus
): Promise<ContentPiece> {
  return updateContentPiece({
    pieceId,
    status: newStatus,
  });
}