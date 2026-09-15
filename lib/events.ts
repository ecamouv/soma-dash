import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent, Client, ContentPiece } from "@/lib/types";
import { PACKAGES, type PackageValue } from "@/lib/packages";
import { nextCodeNumbers, buildPieceCode } from "@/lib/deliveries";

const supabase = createClient();

export async function fetchEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(`
      *,
      client:clients(*),
      content_pieces(*)
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
  // 1. Construir el objeto del evento
  const payload: any = {
    title: eventData.title,
    event_type: eventData.event_type,
    event_date: eventData.event_date,
    event_time: eventData.event_time,
    duration_hours: eventData.duration_hours,
    location: eventData.location,
    notes: eventData.notes,
    client_id: eventData.client_id,
  };

  if (eventData.id) {
    payload.id = eventData.id;
  }

  // 2. Insertar o actualizar el evento en Supabase
  const { data: savedEvent, error: eventError } = await supabase
    .from("events")
    .upsert(payload)
    .select()
    .single();

  if (eventError) {
    console.error("Error al guardar evento en Supabase:", eventError);
    throw eventError;
  }

  // 3. Desvincular piezas que ya no pertenecen a este evento. El calendario solo
  // maneja la asociación event_id <-> pieza; el status de producción (por_grabar,
  // en_edicion, revision, aprobado, publicado) se mueve manualmente desde
  // Entregas/Publicaciones y no se toca aquí.
  const { error: resetError } = await supabase
    .from("content_pieces")
    .update({ event_id: null })
    .eq("event_id", savedEvent.id);

  if (resetError) {
    console.error("Error al desvincular piezas anteriores:", resetError);
  }

  // 4. Vincular las piezas seleccionadas actualmente al evento (sin tocar su status).
  // El picker ahora permite elegir piezas de meses distintos al de la fecha del evento
  // (piezas "adelantadas"), así que el mes de cada una se calcula por separado -- ya no
  // se puede asumir que todas comparten el mes de la primera. Tampoco se toca el mes de
  // una pieza que YA existe en la base: pudo haberse editado a mano (ver ContentPieceModal)
  // y no debe resetearse cada vez que el evento se vuelve a guardar.
  const { data: existingRows } = await supabase
    .from("content_pieces")
    .select("code")
    .eq("client_id", eventData.client_id)
    .in("code", pieceCodes);
  const alreadyExists = new Set((existingRows ?? []).map((r) => r.code));

  for (const code of pieceCodes) {
    if (alreadyExists.has(code)) {
      await supabase
        .from("content_pieces")
        .update({ event_id: savedEvent.id })
        .eq("client_id", eventData.client_id)
        .eq("code", code);
    } else {
      const monthNum = Number(code.split(".")[0]);
      await supabase.from("content_pieces").insert({
        client_id: eventData.client_id,
        event_id: savedEvent.id,
        code: code,
        type: code.includes(".v.") ? "v" : "f",
        month: monthNum,
      });
    }
  }

  // 5. Guardar los miembros del evento. Funciona igual para crear y editar, porque
  // ya tenemos savedEvent.id en ambos casos. La sincronización con Google Calendar
  // (crear/actualizar/cancelar el evento) la hace el llamador con la lista completa
  // de miembros actual -- no solo los recién agregados, porque un cambio de día,
  // hora o lugar también debe reflejarse aunque los miembros no cambien.
  const { error: membersDeleteError } = await supabase
    .from("event_members")
    .delete()
    .eq("event_id", savedEvent.id);
  if (membersDeleteError) {
    console.error("Error al limpiar miembros anteriores:", membersDeleteError);
  }

  if (memberIds.length > 0) {
    const { error: membersInsertError } = await supabase.from("event_members").insert(
      memberIds.map((user_id) => ({
        event_id: savedEvent.id,
        user_id,
        invite_status: "pendiente",
      }))
    );
    if (membersInsertError) {
      console.error("Error al guardar miembros del evento:", membersInsertError);
    }
  }

  return savedEvent;
}

/**
 * Eliminar un evento y desvincular sus piezas (solo event_id -> null).
 * El status de producción no se toca: se mueve manualmente desde Entregas/Publicaciones.
 * Cancela primero el evento de Google Calendar ligado (si existe) -- por eso el
 * orden importa: hay que leer google_event_id antes de borrar la fila.
 */
export async function deleteEventFromSupabase(
  eventId: string
): Promise<{ googleSyncError?: string }> {
  // 1. Cancelar el evento de Google Calendar ligado, si existe. No bloquea el
  // borrado del evento en Soma si esto falla -- solo se reporta al llamador.
  let googleSyncError: string | undefined;
  try {
    await cancelEventInvite(eventId);
  } catch (err) {
    console.error("Error cancelando invitación de Google Calendar:", err);
    googleSyncError = err instanceof Error ? err.message : String(err);
  }

  // 2. Desvincular las piezas del evento antes de borrarlo
  await supabase
    .from("content_pieces")
    .update({ event_id: null })
    .eq("event_id", eventId);

  // 3. Eliminar el evento de Supabase
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) console.error("Error al eliminar evento:", error);

  return { googleSyncError };
}

export async function fetchClients(): Promise<Client[]> {
  const supabase = createClient();
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
  const supabase = createClient();
  const { error } = await supabase.from("clients").update({ paused }).eq("id", clientId);
  if (error) throw error;
}

/**
 * Asignar el color de identidad de un cliente (hex, ej. "#60a5fa"). Se guarda desde
 * Clientes y por ahora solo se usa para pintar su franja/encabezado en Entregas.
 * `null` regresa al cliente a la paleta automática por defecto.
 */
export async function setClientColor(clientId: string, color: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("clients").update({ color }).eq("id", clientId);
  if (error) throw error;
}

export async function createClientRecord(
  name: string,
  packageValue?: PackageValue | null
): Promise<Client> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ name, package: packageValue ?? null })
    .select("id, name, package")
    .single();
  if (error) throw error;
  return data as Client;
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
  const client = await createClientRecord(name, packageValue);
  const pkg = PACKAGES[packageValue];
  const month = new Date().getMonth() + 1;

  const videoNumbers = nextCodeNumbers([], "v", month, pkg.reels);
  const fotoNumbers = nextCodeNumbers([], "f", month, pkg.fotos);

  const rows = [
    ...videoNumbers.map((n) => ({
      client_id: client.id,
      code: buildPieceCode(month, "v", n),
      type: "v",
      month,
    })),
    ...fotoNumbers.map((n) => ({
      client_id: client.id,
      code: buildPieceCode(month, "f", n),
      type: "f",
      month,
    })),
  ];

  if (rows.length > 0) {
    const supabase = createClient();
    const { error } = await supabase.from("content_pieces").insert(rows);
    if (error) throw error;
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

export function parseContentPieces(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseFloat(s))
    .filter((n) => !Number.isNaN(n));
}

export type { ContentPiece };