import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createCalendarInvite,
  updateCalendarInvite,
  deleteCalendarInvite,
  GoogleEventNotFoundError,
} from "@/lib/googleCalendar";

// Sincroniza (crea o actualiza) el evento de Google Calendar ligado a un evento de
// Soma. Un solo evento de Google por evento de Soma: si ya existe google_event_id,
// se hace PATCH (mismo evento, los asistentes ven "se actualizó" en vez de recibir
// una invitación duplicada); si no existe, se crea y el ID se guarda en `events`.
// Si ya no quedan miembros con correo, se cancela el evento de Google (nadie a quien
// notificar) y se limpia google_event_id.
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { eventId, memberIds } = (await request.json()) as {
    eventId: string;
    memberIds: string[];
  };

  if (!eventId || !Array.isArray(memberIds)) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("title, event_date, event_time, duration_hours, location, notes, google_event_id")
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const { data: members, error: membersError } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", memberIds);

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 });
  }

  const attendeeEmails = (members ?? []).map((m) => m.email).filter(Boolean) as string[];
  const skipped = memberIds.filter((id) => !(members ?? []).some((m) => m.id === id));

  // Sin miembros con correo: si había un evento de Google, ya no tiene caso -- se cancela.
  if (attendeeEmails.length === 0) {
    if (event.google_event_id) {
      try {
        await deleteCalendarInvite(event.google_event_id);
      } catch (err) {
        console.error("Error cancelando evento de Google sin asistentes:", err);
      }
      await supabase.from("events").update({ google_event_id: null }).eq("id", eventId);
    }
    return NextResponse.json({ ok: true, invited: [], skipped, googleEventId: null });
  }

  const inviteInput = {
    title: event.title,
    eventDate: event.event_date,
    eventTime: event.event_time,
    durationHours: event.duration_hours,
    location: event.location,
    notes: event.notes,
    attendeeEmails,
  };

  try {
    if (event.google_event_id) {
      try {
        const { googleEventId, htmlLink } = await updateCalendarInvite(
          event.google_event_id,
          inviteInput
        );
        return NextResponse.json({ ok: true, invited: attendeeEmails, skipped, googleEventId, htmlLink });
      } catch (err) {
        if (!(err instanceof GoogleEventNotFoundError)) throw err;
        // El evento guardado ya no existe en Google (se borró manualmente allá) -- se crea de nuevo.
      }
    }

    const { googleEventId, htmlLink } = await createCalendarInvite(inviteInput);
    await supabase.from("events").update({ google_event_id: googleEventId }).eq("id", eventId);
    return NextResponse.json({ ok: true, invited: attendeeEmails, skipped, googleEventId, htmlLink });
  } catch (err) {
    console.error("Error sincronizando evento de Google Calendar:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido al invitar" },
      { status: 502 }
    );
  }
}

// Cancela el evento de Google Calendar ligado, si existe. Se llama antes de borrar
// el evento de Soma (deleteEventFromSupabase necesita leer google_event_id primero).
export async function DELETE(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { eventId } = (await request.json()) as { eventId: string };
  if (!eventId) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("google_event_id")
    .eq("id", eventId)
    .single();

  if (event?.google_event_id) {
    try {
      await deleteCalendarInvite(event.google_event_id);
    } catch (err) {
      console.error("Error cancelando evento de Google Calendar:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Error desconocido al cancelar" },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
