import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent, Client } from "@/lib/types";
import { PACKAGES, type PackageValue } from "@/lib/packages";
import { buildPieceCode, errText, nextCodeNumbers } from "@/lib/utils";

const supabase = createClient();

export async function fetchEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(`
      *,
      client:clients(*),
      content_pieces(*),
      members:event_members(user_id)
    `)
    .order("event_date", { ascending: true });

  if (error) {
    console.error("Error al obtener eventos:", error);
    return [];
  }

  return data as CalendarEvent[];
}

export async function saveEventToSupabase(
  eventData: Partial<CalendarEvent>,
  pieceCodes: string[],
  memberIds: string[] = []
) {
  // 1. Insertar o actualizar el evento
  const { data: savedEvent, error: eventError } = await supabase
    .from("events")
    .upsert({
      ...(eventData.id ? { id: eventData.id } : {}),
      title: eventData.title,
      event_type: eventData.event_type,
      event_date: eventData.event_date,
      event_time: eventData.event_time,
      duration_hours: eventData.duration_hours,
      location: eventData.location,
      notes: eventData.notes,
      client_id: eventData.client_id,
    })
    .select()
    .single();
  if (eventError) throw eventError;

  // 2. Desvincular piezas que ya no pertenecen a este evento. El calendario solo
  // maneja la asociación event_id <-> pieza; el status de producción se mueve
  // manualmente desde Entregas/Publicaciones y no se toca aquí.
  const { error: resetError } = await supabase
    .from("content_pieces")
    .update({ event_id: null })
    .eq("event_id", savedEvent.id);
  if (resetError) throw resetError;

  // 3. Vincular las piezas seleccionadas (sin tocar su status). El picker permite
  // piezas de meses distintos al del evento ("adelantadas"), así que el mes de cada
  // una sale de su code. Tampoco se toca el mes de una pieza que YA existe: pudo
  // haberse editado a mano (ver ContentPieceModal).
  const { data: existingRows, error: existingError } = await supabase
    .from("content_pieces")
    .select("code")
    .eq("client_id", eventData.client_id)
    .in("code", pieceCodes);
  if (existingError) throw existingError;
  const alreadyExists = new Set((existingRows ?? []).map((r) => r.code));

  for (const code of pieceCodes) {
    const { error } = alreadyExists.has(code)
      ? await supabase
          .from("content_pieces")
          .update({ event_id: savedEvent.id })
          .eq("client_id", eventData.client_id)
          .eq("code", code)
      : await supabase.from("content_pieces").insert({
          client_id: eventData.client_id,
          event_id: savedEvent.id,
          code,
          type: code.includes(".v.") ? "v" : "f",
          month: Number(code.split(".")[0]),
        });
    if (error) throw error;
  }

  // 4. Guardar los miembros. La sincronización con Google Calendar la hace el
  // llamador con la lista completa de miembros (un cambio de día/hora/lugar también
  // debe notificarse aunque los miembros no cambien).
  const { error: membersDeleteError } = await supabase
    .from("event_members")
    .delete()
    .eq("event_id", savedEvent.id);
  if (membersDeleteError) throw membersDeleteError;

  if (memberIds.length > 0) {
    const { error: membersInsertError } = await supabase.from("event_members").insert(
      memberIds.map((user_id) => ({ event_id: savedEvent.id, user_id, invite_status: "pendiente" }))
    );
    if (membersInsertError) throw membersInsertError;
  }

  return savedEvent;
}

/**
 * Eliminar un evento y desvincular sus piezas (solo event_id -> null).
 * Cancela primero el evento de Google Calendar ligado (si existe) -- el orden importa:
 * hay que leer google_event_id antes de borrar la fila. Si Google falla no bloquea el
 * borrado (se reporta al llamador); si Supabase falla, se lanza el error.
 */
export async function deleteEventFromSupabase(
  eventId: string
): Promise<{ googleSyncError?: string }> {
  let googleSyncError: string | undefined;
  try {
    await cancelEventInvite(eventId);
  } catch (err) {
    console.error("Error cancelando invitación de Google Calendar:", err);
    googleSyncError = errText(err);
  }

  const { error: unlinkError } = await supabase
    .from("content_pieces")
    .update({ event_id: null })
    .eq("event_id", eventId);
  if (unlinkError) throw unlinkError;

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;

  return { googleSyncError };
}

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, package, price, paused, public_token, color")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Client[];
}

/**
 * Pausar/reanudar un cliente. Pausado congela su logística: el resto de la app
 * filtra su contenido y eventos de Calendario, Entregas y Publicaciones sin
 * borrar nada -- reanudar lo regresa exactamente como estaba.
 */
export async function setClientPaused(clientId: string, paused: boolean): Promise<void> {
  const { error } = await supabase.from("clients").update({ paused }).eq("id", clientId);
  if (error) throw error;
}

/**
 * Asignar el color de identidad de un cliente (hex, ej. "#60a5fa"). `null` regresa al
 * cliente a la paleta automática por defecto.
 */
export async function setClientColor(clientId: string, color: string | null): Promise<void> {
  const { error } = await supabase.from("clients").update({ color }).eq("id", clientId);
  if (error) throw error;
}

/**
 * Crear un cliente nuevo con un paquete asignado y generar de una vez las piezas
 * de video/foto que le corresponden (status inicial "por_grabar", sin evento ni
 * fecha de entrega). Los carruseles del paquete NO generan piezas todavía.
 * "solamente_pauta" no genera ninguna pieza.
 */
export async function createClientWithPackage(
  name: string,
  packageValue: PackageValue
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .insert({ name, package: packageValue })
    .select("id, name, package")
    .single();
  if (error) throw error;
  const client = data as Client;

  const pkg = PACKAGES[packageValue];
  const month = new Date().getMonth() + 1;
  const rows = (["v", "f"] as const).flatMap((type) =>
    nextCodeNumbers([], type, month, type === "v" ? pkg.reels : pkg.fotos).map((n) => ({
      client_id: client.id,
      code: buildPieceCode(month, type, n),
      type,
      month,
    }))
  );

  if (rows.length > 0) {
    const { error: piecesError } = await supabase.from("content_pieces").insert(rows);
    if (piecesError) throw piecesError;
  }

  return client;
}

/**
 * Sincroniza el evento de Google Calendar ligado a un evento de Soma: lo crea si
 * no existe, o lo actualiza (PATCH, mismo evento) si ya existe -- se debe llamar
 * en cada guardado, no solo cuando cambian los miembros, porque un cambio de día/
 * hora/lugar también debe notificarse a los asistentes ya invitados.
 */
export async function sendInvitations(
  eventId: string,
  memberIds: string[]
): Promise<{ invited: string[]; skipped: string[]; googleEventId: string | null }> {
  const res = await fetch("/api/events/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, memberIds }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status} al enviar invitaciones`);
  }
  return data;
}

/** Cancela el evento de Google Calendar ligado a un evento de Soma, si existe. */
export async function cancelEventInvite(eventId: string): Promise<void> {
  const res = await fetch("/api/events/invite", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status} al cancelar la invitación`);
  }
}
