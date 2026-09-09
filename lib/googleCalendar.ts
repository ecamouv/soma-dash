// Integración con Google Calendar usando un refresh token de una cuenta admin
// (la cuenta "dueña" de las invitaciones). Requiere GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en el entorno del servidor.
//
// Sincronización de un solo sentido: Dashboard -> Google Calendar. Los cambios se
// disparan únicamente cuando el evento se crea/edita/borra desde Soma; nunca leemos
// cambios de vuelta desde Google (no hay webhook ni polling).
//
// Hermosillo, Sonora no observa horario de verano (nunca se alinea con el resto
// de México durante el DST de EE.UU./México), así que America/Hermosillo es un
// offset fijo de -07:00 todo el año -- no hace falta una librería de timezones
// para este cálculo.
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_BASE_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const HERMOSILLO_OFFSET = "-07:00";
const HERMOSILLO_OFFSET_HOURS = 7;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Faltan variables de entorno de Google (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)."
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `No se pudo obtener el access token de Google: ${data.error_description || data.error || res.statusText}`
    );
  }
  return data.access_token as string;
}

function toRFC3339Hermosillo(d: Date): string {
  // d es un instante UTC real. Lo desplazamos -7h y formateamos como si fuera
  // UTC para obtener la hora de pared de Hermosillo, y le pegamos el offset
  // fijo -07:00 explícito.
  const shifted = new Date(d.getTime() - HERMOSILLO_OFFSET_HOURS * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 19) + HERMOSILLO_OFFSET;
}

export interface CalendarInviteInput {
  title: string;
  eventDate: string; // YYYY-MM-DD
  eventTime: string | null; // HH:MM:SS o null
  durationHours: number | null;
  location: string | null;
  notes: string | null;
  attendeeEmails: string[];
}

/** Error específico para cuando Google ya no tiene el evento (404/410) -- ya sea
 * porque se borró manualmente desde Google o porque el ID guardado quedó obsoleto. */
export class GoogleEventNotFoundError extends Error {
  constructor(message = "El evento ya no existe en Google Calendar") {
    super(message);
    this.name = "GoogleEventNotFoundError";
  }
}

function buildEventBody(input: CalendarInviteInput) {
  const start: Record<string, string> = {};
  const end: Record<string, string> = {};

  if (input.eventTime) {
    const startInstant = new Date(`${input.eventDate}T${input.eventTime}${HERMOSILLO_OFFSET}`);
    const hours = input.durationHours && input.durationHours > 0 ? input.durationHours : 1;
    const endInstant = new Date(startInstant.getTime() + hours * 60 * 60 * 1000);

    start.dateTime = toRFC3339Hermosillo(startInstant);
    start.timeZone = "America/Hermosillo";
    end.dateTime = toRFC3339Hermosillo(endInstant);
    end.timeZone = "America/Hermosillo";
  } else {
    // Sin hora especificada: evento de todo el día.
    start.date = input.eventDate;
    end.date = input.eventDate;
  }

  return {
    summary: input.title,
    location: input.location || undefined,
    description: input.notes || undefined,
    start,
    end,
    attendees: input.attendeeEmails.map((email) => ({ email })),
    // Los invitados solo pueden ver el evento y responder -- no pueden modificarlo.
    guestsCanModify: false,
  };
}

async function requestGoogle(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
) {
  const accessToken = await getAccessToken();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null; // DELETE exitoso, sin cuerpo
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 404 || res.status === 410) {
      throw new GoogleEventNotFoundError(data.error?.message);
    }
    throw new Error(`Google Calendar rechazó la solicitud: ${data.error?.message || res.statusText}`);
  }
  return data;
}

/** Crea un evento nuevo en Google Calendar y manda la invitación a los asistentes. */
export async function createCalendarInvite(
  input: CalendarInviteInput
): Promise<{ googleEventId: string; htmlLink: string }> {
  const data = await requestGoogle(`${EVENTS_BASE_URL}?sendUpdates=all`, "POST", buildEventBody(input));
  return { googleEventId: data.id, htmlLink: data.htmlLink };
}

/**
 * Actualiza un evento existente (día/hora/lugar/asistentes/etc.) y notifica a los
 * asistentes del cambio. Lanza GoogleEventNotFoundError si el evento ya no existe
 * en Google (por ejemplo, se borró manualmente desde Google Calendar) -- el llamador
 * puede capturarlo y crear uno nuevo en su lugar.
 */
export async function updateCalendarInvite(
  googleEventId: string,
  input: CalendarInviteInput
): Promise<{ googleEventId: string; htmlLink: string }> {
  const data = await requestGoogle(
    `${EVENTS_BASE_URL}/${googleEventId}?sendUpdates=all`,
    "PATCH",
    buildEventBody(input)
  );
  // Un evento borrado directamente en Google (no desde el dashboard) no siempre
  // responde 404/410 al hacer PATCH: a veces regresa 200 con status:"cancelled"
  // (el evento sigue "existiendo" en estado cancelado). Lo tratamos igual que un
  // 404 para que el llamador cree uno nuevo en su lugar.
  if (data.status === "cancelled") {
    throw new GoogleEventNotFoundError("El evento fue cancelado en Google Calendar");
  }
  return { googleEventId: data.id, htmlLink: data.htmlLink };
}

/**
 * Cancela (borra) un evento en Google Calendar y notifica a los asistentes.
 * Si el evento ya no existe (404/410), lo trata como éxito -- ya está en el
 * estado deseado.
 */
export async function deleteCalendarInvite(googleEventId: string): Promise<void> {
  try {
    await requestGoogle(`${EVENTS_BASE_URL}/${googleEventId}?sendUpdates=all`, "DELETE");
  } catch (err) {
    if (err instanceof GoogleEventNotFoundError) return;
    throw err;
  }
}
