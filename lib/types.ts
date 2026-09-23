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
  // Color asignado a mano desde Clientes (hex, ej. "#60a5fa"). Si es null, la UI
  // usa su paleta automática por defecto -- por ahora solo se usa en Entregas.
  color?: string | null;
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
export type ProspectStage =
  | "nuevo"
  | "contactado"
  | "reunion"
  | "propuesta"
  | "negociacion"
  | "ganado"
  | "perdido";

export const PROSPECT_STAGES: ProspectStage[] = [
  "nuevo",
  "contactado",
  "reunion",
  "propuesta",
  "negociacion",
  "ganado",
  "perdido",
];

export const PROSPECT_STAGE_LABEL: Record<ProspectStage, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  reunion: "Reunión",
  propuesta: "Propuesta",
  negociacion: "Negociación",
  ganado: "Ganado",
  perdido: "Perdido",
};

export const PROSPECT_STAGE_COLOR: Record<ProspectStage, string> = {
  nuevo: "#718096",
  contactado: "#3182CE",
  reunion: "#319795",
  propuesta: "#805AD5",
  negociacion: "#DD6B20",
  ganado: "#38A169",
  perdido: "#E53E3E",
};

export interface Prospect {
  id: string;
  name: string;
  contact_name?: string | null;
  contact_role?: string | null;
  email?: string | null;
  phone?: string | null;
  market?: string | null;
  city?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  website?: string | null;
  source?: string | null;
  stage: ProspectStage;
  estimated_value?: number | null;
  next_step?: string | null;
  next_step_date?: string | null;
  notes?: string | null;
  owner_id?: string | null;
  converted_client_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type ProspectInput = Omit<
  Prospect,
  "id" | "created_at" | "updated_at" | "converted_client_id"
>;

export interface ProspectActivity {
  id: string;
  prospect_id: string;
  note: string;
  created_by?: string | null;
  created_at: string;
  author?: Pick<Profile, "full_name" | "initials"> | null;
}
