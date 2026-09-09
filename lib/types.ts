export type UserRole = "prod" | "admin" | "community" | "editor";

export const ROLE_LABEL: Record<UserRole, string> = {
  prod: "Productor",
  admin: "Administrador",
  community: "Community Manager",
  editor: "Editor"
};

export type EventType = "grabacion" | "cobertura" | "junta" | "entrega" | "otro";

export const EVENT_TYPE_COLOR: Record<EventType, string> = {
  grabacion: "#E53E3E",
  cobertura: "#DD6B20",
  junta: "#319795",
  entrega: "#3182CE",
  otro: "#718096",
};

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  initials: string;
}

export interface Client {
  id: string;
  name: string;
  // '1' | '2' | '3' | 'solamente_pauta' -- ver lib/packages.ts (PackageValue).
  package?: string | null;
  // Lo que paga el cliente (MXN). Puede quedar vacío hasta que se capture.
  price?: number | null;
  // Cliente pausado: su contenido/eventos se ocultan de Calendario, Entregas y
  // Publicaciones (sin borrar nada) hasta que se reanude.
  paused?: boolean;
  // Token opaco para el link público de calendario (/c/[public_token]).
  public_token?: string;
}

export interface ClientPayment {
  id: string;
  client_id: string;
  due_date: string;
  label?: string | null;
  amount?: number | null;
}

export type PieceStatus = 'por_grabar' | 'en_edicion' | 'revision' | 'aprobado' | 'publicado';

export interface ContentPiece {
  id: string;
  client_id: string;
  event_id?: string | null;
  editor_id?: string | null;
  code: string; // ej. 5.1, 9.v.1
  // Nombre opcional que reemplaza al code en la UI dondequiera que se muestre
  // el nombre de la pieza. Si es null/vacío, se sigue mostrando el code.
  display_name?: string | null;
  type: 'v' | 'f';
  month: number;
  status: PieceStatus;
  due_date?: string | null;
  script?: string | null;
  meta_url?: string | null;
  client?: Client;
  editor?: Profile;
  // Fecha del evento de grabación ligado (join sobre event_id), cuando se pide explícitamente.
  event?: { event_date: string } | null;
}

/** Nombre a mostrar de una pieza: su display_name si tiene, si no su code. */
export function pieceLabel(piece: Pick<ContentPiece, "code" | "display_name">): string {
  return piece.display_name?.trim() || piece.code;
}

export interface EventMember {
  event_id: string;
  user_id: string;
  invite_status: "pendiente" | "enviado" | "aceptado";
  profile: Profile;
}

export interface CalendarEvent {
  id: string;
  title: string;
  event_type: EventType;
  event_date: string;
  event_time: string | null;
  duration_hours: number;
  location: string | null;
  notes: string | null;
  client_id: string | null;
  created_by: string | null;
  client?: Client | null;
  members: EventMember[];
  content_pieces: ContentPiece[];
}