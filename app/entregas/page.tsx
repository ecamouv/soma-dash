"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { LuChevronUp, LuChevronDown, LuChevronsUpDown, LuChevronRight, LuVideo, LuCamera, LuMaximize2, LuMinimize2, LuX } from "react-icons/lu";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ContentPieceModal from "@/components/ContentPieceModal";
import NewPieceModal from "@/components/NewPieceModal";
import { pieceLabel, type ContentPiece, type Client, type PieceStatus, type Profile } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  updatePieceStatus,
  updatePieceDueDateAndName,
  createContentPiece,
  consumeBlankPlaceholder,
  nextCodeNumbers,
  buildPieceCode,
} from "@/lib/deliveries";
import { defaultClientColor, hexToRgba } from "@/lib/clientColors";

// Entregas cubre las etapas de producción, de "por_grabar" a "aprobado".
// "publicado" se marca desde la página de Publicaciones y no vive aquí.
const STATUS_COLUMNS: {
  status: PieceStatus;
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}[] = [
  {
    status: "por_grabar",
    label: "Por grabar",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
    dot: "bg-blue-400",
  },
  {
    status: "en_edicion",
    label: "En edición",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    border: "border-violet-500/30",
    dot: "bg-violet-400",
  },
  {
    status: "revision",
    label: "Revisión",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
  },
  {
    status: "aprobado",
    label: "Aprobado",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
  },
];

// Todos los status posibles (incluye "publicado", que no tiene columna en el kanban
// de Entregas pero sí aparece en la tabla maestra de abajo).
const ALL_STATUS_META: Record<
  PieceStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  por_grabar: STATUS_COLUMNS[0],
  en_edicion: STATUS_COLUMNS[1],
  revision: STATUS_COLUMNS[2],
  aprobado: STATUS_COLUMNS[3],
  publicado: {
    label: "Publicado",
    bg: "bg-teal-500/10",
    text: "text-teal-400",
    border: "border-teal-500/30",
    dot: "bg-teal-400",
  },
};

// Identidad de tipo de pieza -- monocromática a propósito (ícono + texto gris, sin
// fondo de color): el único color que vive en la tarjeta es el dot de cliente.
const TYPE_META: Record<"v" | "f", { label: string; Icon: typeof LuVideo }> = {
  v: { label: "Video", Icon: LuVideo },
  f: { label: "Foto", Icon: LuCamera },
};

// Transición manual hacia adelante permitida por columna (null = sin acción manual).
const NEXT_STATUS: Partial<Record<PieceStatus, PieceStatus>> = {
  por_grabar: "en_edicion",
  en_edicion: "revision",
  revision: "aprobado",
};

// Transición manual hacia atrás permitida por columna (null = sin acción manual).
const PREV_STATUS: Partial<Record<PieceStatus, PieceStatus>> = {
  en_edicion: "por_grabar",
  revision: "en_edicion",
  aprobado: "revision",
};

// El color por cliente (franja del kanban y encabezado de "Todas las piezas") ahora
// sale de client.color si se asignó a mano en Clientes, o de defaultClientColor()
// como paleta automática de respaldo -- ver lib/clientColors.ts.

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

function toISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

// Fecha efectiva para ubicar una pieza en la grilla: su fecha de entrega si la tiene,
// si no, la fecha del evento de grabación al que está ligada (event.event_date).
function pieceDate(piece: ContentPiece): string | null {
  if (piece.due_date) return piece.due_date;
  if (piece.event?.event_date) return piece.event.event_date.slice(0, 10);
  return null;
}

// "Adelantado": se calcula, no se guarda -- compara el mes en que realmente se grabó
// (el mes del evento de grabación ligado) contra el mes al que pertenece la pieza
// (piece.month, su categorización de paquete). Si se grabó antes de su mes, es una
// pieza adelantada. Cubre el cruce diciembre -> enero; no contempla saltos de año
// más raros porque piece.month tampoco guarda año en ningún otro lado del sistema.
function isAdvancePiece(piece: ContentPiece): boolean {
  if (!piece.event?.event_date) return false;
  const eventMonth = Number(piece.event.event_date.slice(5, 7));
  if (!eventMonth || eventMonth === piece.month) return false;
  if (piece.month === 1 && eventMonth === 12) return true;
  return eventMonth < piece.month;
}

// Tag compacto de 2-3 letras para identificar cliente en la tarjeta sin repetir el
// nombre completo: iniciales de hasta 3 palabras, o las primeras 3 letras si es una
// sola palabra ("Filmalo" -> "FIL", "Tres Leches" -> "TL").
function clientInitials(name: string | undefined): string {
  if (!name) return "—";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  }
  return name.trim().slice(0, 3).toUpperCase();
}

interface ClientGroup {
  key: string;
  client: Client | undefined;
  pieces: ContentPiece[];
}

// Agrupa una lista ya ordenada (por due_date) en sub-grupos por cliente, preservando
// ese orden dentro de cada grupo. Los grupos se ordenan por la fecha más próxima que
// tengan (su primera pieza, ya que cada grupo hereda el orden de la lista original).
function groupPiecesByClient(pieces: ContentPiece[]): ClientGroup[] {
  const map = new Map<string, ClientGroup>();
  for (const p of pieces) {
    const key = p.client_id ?? "sin-cliente";
    if (!map.has(key)) map.set(key, { key, client: p.client, pieces: [] });
    map.get(key)!.pieces.push(p);
  }
  return [...map.values()].sort((a, b) => {
    const aDate = a.pieces[0]?.due_date;
    const bDate = b.pieces[0]?.due_date;
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.localeCompare(bDate);
  });
}

function comparePieces(
  a: ContentPiece,
  b: ContentPiece,
  by: "code" | "due_date",
  dir: "asc" | "desc"
): number {
  let cmp: number;
  if (by === "due_date") {
    if (!a.due_date && !b.due_date) cmp = a.code.localeCompare(b.code);
    else if (!a.due_date) cmp = 1;
    else if (!b.due_date) cmp = -1;
    else cmp = a.due_date.localeCompare(b.due_date) || a.code.localeCompare(b.code);
  } else {
    cmp = a.code.localeCompare(b.code);
  }
  return dir === "desc" ? -cmp : cmp;
}

function SortIcon({
  sort,
  column,
}: {
  sort: { by: "code" | "due_date"; dir: "asc" | "desc" };
  column: "code" | "due_date";
}) {
  if (sort.by !== column) {
    return <LuChevronsUpDown className="h-3 w-3 opacity-50" />;
  }
  return sort.dir === "asc" ? (
    <LuChevronUp className="h-3 w-3" />
  ) : (
    <LuChevronDown className="h-3 w-3" />
  );
}

// Altura fija equivalente a ~8 piezas visibles (encabezado + 8 filas) antes de que
// la tabla entre en scroll interno. El fade de abajo solo aparece si hay más
// contenido por ver y desaparece al llegar al fondo del scroll.
const PIECES_TABLE_MAX_HEIGHT = "18.5rem";

// Encabezado de cliente en blanco/negro puro -- deliberadamente sin la paleta de
// color por cliente (esa se queda solo en el kanban, ver CLIENT_COLOR_PALETTE). Acá
// la identidad se construye con tipografía (h1 grande y condensada), stroke, sombra
// y gradiente en vez de tono, para diferenciarse del resto del dashboard.
function ClientPieceTable({
  group,
  color,
  sort,
  onToggleSort,
  onSelectPiece,
}: {
  group: { client: Client | undefined; pieces: ContentPiece[] };
  color: string;
  sort: { by: "code" | "due_date"; dir: "asc" | "desc" };
  onToggleSort: (by: "code" | "due_date") => void;
  onSelectPiece: (piece: ContentPiece) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const sortedPieces = useMemo(
    () => [...group.pieces].sort((a, b) => comparePieces(a, b, sort.by, sort.dir)),
    [group.pieces, sort.by, sort.dir]
  );

  const updateFade = () => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 1;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    setShowFade(hasOverflow && !atBottom);
  };

  useEffect(() => {
    updateFade();
  }, [sortedPieces, expanded]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-elevated">
      <div
        className="relative overflow-hidden border-b px-4 py-3"
        style={{
          borderColor: hexToRgba(color, 0.35),
          background: `linear-gradient(to bottom right, ${hexToRgba(color, 0.16)}, rgba(255,255,255,0.02), transparent)`,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h3
            className="min-w-0 truncate font-display text-base font-extrabold uppercase tracking-tight"
            style={{ color }}
          >
            {group.client?.name ?? "Sin cliente"}
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold"
              style={{ borderColor: hexToRgba(color, 0.4), color }}
            >
              {group.pieces.length}
            </span>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Contraer" : "Expandir para ver todas sin scroll"}
              className="rounded-md border border-line p-1 text-muted transition hover:border-line/80 hover:text-text"
            >
              {expanded ? (
                <LuMinimize2 className="h-3 w-3" />
              ) : (
                <LuMaximize2 className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={updateFade}
          className="overflow-x-auto overflow-y-auto"
          style={expanded ? undefined : { maxHeight: PIECES_TABLE_MAX_HEIGHT }}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line/60 bg-panel2/50 text-left text-muted">
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]">
                  <button
                    onClick={() => onToggleSort("code")}
                    className="flex items-center gap-1 hover:text-text"
                  >
                    Pieza <SortIcon sort={sort} column="code" />
                  </button>
                </th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Tipo</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]">
                  <button
                    onClick={() => onToggleSort("due_date")}
                    className="flex items-center gap-1 hover:text-text"
                  >
                    Entrega <SortIcon sort={sort} column="due_date" />
                  </button>
                </th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedPieces.map((piece) => {
                const meta = ALL_STATUS_META[piece.status] ?? {
                  label: piece.status,
                  bg: "bg-panel2",
                  text: "text-muted",
                };
                return (
                  <tr
                    key={piece.id}
                    onClick={() => onSelectPiece(piece)}
                    className="border-b border-line/60 last:border-0 cursor-pointer hover:bg-panel2/40"
                  >
                    <td className="px-4 py-2 font-mono font-semibold text-text">{pieceLabel(piece)}</td>
                    <td className="px-4 py-2 text-muted">{piece.type === "v" ? "Video" : "Foto"}</td>
                    <td className="px-4 py-2 text-muted">
                      {piece.due_date ? formatDay(piece.due_date) : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${meta.bg} ${meta.text}`}>
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!expanded && showFade && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-panel via-panel/70 to-transparent" />
        )}
      </div>
    </div>
  );
}

export default function DeliveriesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<ContentPiece | null>(null);
  const [isNewPieceOpen, setIsNewPieceOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Vista activa: kanban o tabla por cliente -- nunca las dos a la vez (eran la misma
  // información duplicada). Persistida para no resetearse al volver a la página.
  const [view, setView] = useState<"kanban" | "cliente">("kanban");
  // Colapso de "Sin fecha de grabación", persistido para que no se resetee al volver.
  const [unscheduledCollapsed, setUnscheduledCollapsed] = useState(false);
  // Arrastrar-y-soltar entre columnas del kanban: solo permite el mismo salto de un
  // paso que ya permiten los botones ← / → (NEXT_STATUS/PREV_STATUS), para no saltarse
  // etapas del pipeline arrastrando.
  const [draggedPieceId, setDraggedPieceId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<PieceStatus | null>(null);
  // Orden de la tabla "Todas las piezas", independiente por cliente (clave = client_id).
  const [clientSort, setClientSort] = useState<
    Record<string, { by: "code" | "due_date"; dir: "asc" | "desc" }>
  >({});

  // 1. Validar sesión y obtener Perfil real desde public.profiles
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setCurrentUser(
        (userProfile as Profile) || {
          id: user.id,
          email: user.email || "",
          full_name: user.email?.split("@")[0] || "Usuario",
          role: "prod",
          initials: (user.email || "U").substring(0, 2).toUpperCase(),
        }
      );
      setLoadingAuth(false);
    };

    checkUser();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Persistir la vista activa y el colapso de "Sin fecha de grabación" en localStorage.
  useEffect(() => {
    try {
      const storedView = localStorage.getItem("entregas:view");
      if (storedView === "kanban" || storedView === "cliente") setView(storedView);
      const stored = localStorage.getItem("entregas:unscheduledCollapsed");
      if (stored !== null) setUnscheduledCollapsed(stored === "1");
    } catch {
      // localStorage no disponible (SSR, navegación privada, etc.) -- se ignora.
    }
  }, []);

  const changeView = (next: "kanban" | "cliente") => {
    setView(next);
    try {
      localStorage.setItem("entregas:view", next);
    } catch {
      // localStorage no disponible -- el estado en memoria sigue funcionando igual.
    }
  };

  const toggleUnscheduledCollapsed = () => {
    setUnscheduledCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("entregas:unscheduledCollapsed", next ? "1" : "0");
      } catch {
        // localStorage no disponible -- el estado en memoria sigue funcionando igual.
      }
      return next;
    });
  };

  const getClientSort = (key: string) => clientSort[key] ?? { by: "code" as const, dir: "asc" as const };

  const toggleClientSort = (key: string, by: "code" | "due_date") => {
    setClientSort((prev) => {
      const current = prev[key] ?? { by: "code" as const, dir: "asc" as const };
      const nextDir: "asc" | "desc" =
        current.by === by && current.dir === "asc" ? "desc" : "asc";
      return { ...prev, [key]: { by, dir: nextDir } };
    });
  };

  const monthStartISO = useMemo(() => toISO(startOfMonth(month)), [month]);
  const monthEndISO = useMemo(() => toISO(endOfMonth(month)), [month]);

  // Los clientes pausados se filtran por completo: ni sus piezas ni ellos mismos
  // aparecen en ningún lado de Entregas (kanban, alertas, tabla maestra, selector).
  const loadData = async () => {
    setLoading(true);
    const [piecesRes, clientsRes] = await Promise.all([
      supabase.from("content_pieces").select("*, client:clients(*), event:events(event_date)"),
      supabase.from("clients").select("*").order("name"),
    ]);

    if (piecesRes.data) {
      setPieces((piecesRes.data as ContentPiece[]).filter((p) => !p.client?.paused));
    }
    if (clientsRes.data) {
      setClients((clientsRes.data as Client[]).filter((c) => !c.paused));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!loadingAuth) {
      loadData();
    }
  }, [loadingAuth]);

  const clientFilteredPieces = useMemo(() => {
    if (selectedClientId === "all") return pieces;
    return pieces.filter((p) => p.client_id === selectedClientId);
  }, [pieces, selectedClientId]);

  // Entran a la grilla las piezas que tengan de dónde sacar una fecha: su fecha de
  // entrega/publicación manual, o si no la tienen, la fecha del evento de grabación
  // ligado (pieceDate ya resuelve esa prioridad). Ya no se exige event_id -- una pieza
  // con fecha de publicación pero sin grabación agendada también debe poder editarse
  // aquí, igual que ya es visible en Publicaciones.
  const filteredPieces = useMemo(() => {
    return clientFilteredPieces.filter((p) => {
      if (p.status === "publicado") return false;
      const date = pieceDate(p);
      if (!date) return false;
      if (date < monthStartISO || date > monthEndISO) return false;
      return true;
    });
  }, [clientFilteredPieces, monthStartISO, monthEndISO]);

  // Piezas sin ninguna fecha (ni de entrega/publicación manual, ni de evento de
  // grabación ligado): no tienen de dónde ubicarse en ningún mes, así que se muestran
  // aparte para poder abrirlas y al menos asignarles una fecha a mano.
  const unscheduledPieces = useMemo(() => {
    return clientFilteredPieces.filter((p) => p.status !== "publicado" && !pieceDate(p));
  }, [clientFilteredPieces]);

  // Tabla maestra: piezas de todos los clientes del mes seleccionado (mismo mes que
  // navega el kanban), agrupadas en una tabla separada por cliente. Se filtra por
  // pieceDate igual que el kanban -- una pieza sin ninguna fecha no pertenece a
  // ningún mes, así que no aparece aquí (se queda en "Sin fecha de grabación").
  // El orden de cada tabla se aplica al renderizar (ver clientSort/toggleClientSort).
  const piecesByClient = useMemo(() => {
    const inMonth = clientFilteredPieces.filter((p) => {
      const date = pieceDate(p);
      return !!date && date >= monthStartISO && date <= monthEndISO;
    });
    const groups = new Map<string, { client: Client | undefined; pieces: ContentPiece[] }>();
    for (const p of inMonth) {
      const key = p.client_id ?? "sin-cliente";
      if (!groups.has(key)) groups.set(key, { client: p.client, pieces: [] });
      groups.get(key)!.pieces.push(p);
    }
    return [...groups.values()].sort((a, b) =>
      (a.client?.name ?? "").localeCompare(b.client?.name ?? "")
    );
  }, [clientFilteredPieces, monthStartISO, monthEndISO]);

  // Color por cliente para la franja del kanban y el encabezado de "Todas las
  // piezas": el que se asignó a mano en Clientes (client.color) o si no, la paleta
  // automática por índice. Se calcula sobre `clients` (orden alfabético estable) y
  // no sobre piecesByClient, que ahora varía con el mes: si saliera de ahí, un
  // cliente podría cambiar de color entre meses según quién más tenga piezas ese mes.
  const clientColorMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((c, i) => {
      map.set(c.id, c.color || defaultClientColor(i));
    });
    return map;
  }, [clients]);

  // Piezas por columna, ordenadas por fecha de entrega -- de más cercana a más
  // distante, y las que no tienen fecha van al final. Se recalcula automáticamente
  // cada vez que cambia una fecha (filteredPieces depende de `pieces`, que se
  // actualiza en cuanto se guarda un cambio de fecha).
  const piecesByStatus = useMemo(() => {
    const map = new Map<PieceStatus, ContentPiece[]>();
    for (const col of STATUS_COLUMNS) map.set(col.status, []);
    for (const p of filteredPieces) {
      map.get(p.status)?.push(p);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    }
    return map;
  }, [filteredPieces]);

  const handleMove = async (piece: ContentPiece, newStatus: PieceStatus) => {
    setMovingId(piece.id);
    setErrorMsg(null);
    try {
      await updatePieceStatus(piece.id, newStatus);
      setPieces((prev) =>
        prev.map((p) => (p.id === piece.id ? { ...p, status: newStatus } : p))
      );
    } catch (err) {
      console.error("Error al mover la pieza:", err);
      setErrorMsg(
        `No se pudo mover ${pieceLabel(piece)} a "${ALL_STATUS_META[newStatus]?.label ?? newStatus}": ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setMovingId(null);
    }
  };

  // Arrastrar-y-soltar solo debe permitir el mismo salto de un paso que ya permiten
  // los botones ← / →, nunca saltarse etapas del pipeline.
  const isValidDropTarget = (piece: ContentPiece | undefined, target: PieceStatus) => {
    if (!piece) return false;
    return NEXT_STATUS[piece.status] === target || PREV_STATUS[piece.status] === target;
  };

  const handleSavePiece = async (
    pieceId: string,
    dueDate: string | null,
    displayName: string | null,
    pieceMonth: number
  ) => {
    setErrorMsg(null);
    try {
      await updatePieceDueDateAndName(pieceId, dueDate, displayName, pieceMonth);
      setPieces((prev) =>
        prev.map((p) =>
          p.id === pieceId
            ? { ...p, due_date: dueDate, display_name: displayName, month: pieceMonth }
            : p
        )
      );
    } catch (err) {
      console.error("Error al guardar la pieza:", err);
      setErrorMsg(
        `No se pudo guardar la pieza: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  };

  const handleCreatePiece = async (input: {
    clientId: string;
    type: "v" | "f";
    dueDate: string | null;
    displayName: string | null;
    month: number;
  }) => {
    // Pieza "adelantada": pertenece a un mes que todavía no llega. En vez de sumarse
    // de más al total del paquete de ese mes, consume (borra) un cupo en blanco ya
    // generado por el paquete para ese cliente+mes+tipo -- si no hay ninguno en blanco
    // disponible, no se resta nada (nunca se toca una pieza con información real).
    const currentRealMonth = new Date().getMonth() + 1;
    if (input.month > currentRealMonth) {
      await consumeBlankPlaceholder(input.clientId, input.month, input.type);
    }

    const existingCodes = pieces
      .filter((p) => p.client_id === input.clientId)
      .map((p) => p.code);
    const [n] = nextCodeNumbers(existingCodes, input.type, input.month, 1);
    const code = buildPieceCode(input.month, input.type, n);

    await createContentPiece({
      clientId: input.clientId,
      code,
      type: input.type,
      month: input.month,
      dueDate: input.dueDate,
      displayName: input.displayName,
    });

    // Recarga completa: si se consumió un cupo en blanco, el estado local necesita
    // reflejar tanto esa baja como la nueva pieza creada.
    await loadData();
  };

  if (loadingAuth || !currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-ink text-muted font-mono text-sm">
        Cargando sesión...
      </div>
    );
  }

  return (
    <div className="flex h-screen text-text">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto bg-ink">
        <TopBar profile={currentUser} onLogout={handleLogout} />


        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs text-muted">Operación › Entregas</span>
              <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-text to-muted bg-clip-text text-transparent">Entregas</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-line bg-panel p-0.5">
                <button
                  type="button"
                  onClick={() => changeView("kanban")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    view === "kanban" ? "bg-panel2 text-text shadow-sm" : "text-muted hover:text-text"
                  }`}
                >
                  Kanban
                </button>
                <button
                  type="button"
                  onClick={() => changeView("cliente")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    view === "cliente" ? "bg-panel2 text-text shadow-sm" : "text-muted hover:text-text"
                  }`}
                >
                  Por cliente
                </button>
              </div>
              <button
                onClick={() => setIsNewPieceOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-on-primary bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow"
              >
                + Nueva pieza
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              <span>{errorMsg}</span>
              <button
                onClick={() => setErrorMsg(null)}
                aria-label="Cerrar aviso"
                className="shrink-0 rounded-md p-1 -m-1 text-red-300 hover:bg-red-500/10 hover:text-red-100"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Filtros: mes y cliente */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3 shadow-sm">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMonth(startOfMonth(new Date()))}
                className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-text hover:bg-panel2"
              >
                Hoy
              </button>
              <button
                onClick={() => setMonth((m) => addMonths(m, -1))}
                aria-label="Mes anterior"
                className="rounded-md border border-line px-2.5 py-1.5 text-sm text-muted hover:text-text hover:bg-panel2"
              >
                ‹
              </button>
              <button
                onClick={() => setMonth((m) => addMonths(m, 1))}
                aria-label="Mes siguiente"
                className="rounded-md border border-line px-2.5 py-1.5 text-sm text-muted hover:text-text hover:bg-panel2"
              >
                ›
              </button>
              <span className="ml-2 font-display text-sm font-semibold text-text">
                {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
              </span>
            </div>

            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="rounded-xl border border-line bg-panel2 px-3 py-1.5 text-xs text-text focus:border-brand2 focus:outline-none transition"
            >
              <option value="all">Todos los clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Piezas sin evento de grabación ligado: no caen en ningún mes hasta que tengan una fecha */}
          {!loading && unscheduledPieces.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <button
                type="button"
                onClick={toggleUnscheduledCollapsed}
                className="flex w-full items-center gap-1.5 px-1 text-left"
              >
                <LuChevronRight
                  className={`h-3.5 w-3.5 text-amber-400 transition-transform ${
                    unscheduledCollapsed ? "" : "rotate-90"
                  }`}
                />
                <h2 className="text-xs font-bold uppercase text-amber-400">
                  Sin fecha de grabación ({unscheduledPieces.length})
                </h2>
              </button>
              {!unscheduledCollapsed && (
                <div className="flex flex-wrap gap-2">
                  {unscheduledPieces.map((piece) => (
                    <button
                      key={piece.id}
                      onClick={() => setSelectedPiece(piece)}
                      className="flex items-center gap-1.5 rounded-md border border-line bg-panel2 px-2.5 py-1.5 text-xs hover:border-brand2/60 transition"
                    >
                      <span className="font-mono font-semibold text-text">{pieceLabel(piece)}</span>
                      <span className="text-muted">· {piece.client?.name ?? "Sin cliente"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Kanban - vista de piezas en Entregas */}
          {view === "kanban" && (
            loading ? (
              <div className="text-xs text-muted p-4">Cargando piezas...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {STATUS_COLUMNS.map((col) => {
                  const colPieces = piecesByStatus.get(col.status) ?? [];
                  const draggedPiece = pieces.find((p) => p.id === draggedPieceId);
                  const isValidDrop = isValidDropTarget(draggedPiece, col.status);
                  const isDragOver = dragOverStatus === col.status;
                  // Agrupar por cliente solo tiene sentido viendo "todos los clientes" --
                  // si ya se filtró a uno, el mini-header sería redundante con el filtro.
                  const groups: ClientGroup[] =
                    selectedClientId === "all"
                      ? groupPiecesByClient(colPieces)
                      : [{ key: selectedClientId, client: colPieces[0]?.client, pieces: colPieces }];

                  return (
                    <div
                      key={col.status}
                      onDragOver={(e) => {
                        if (!isValidDrop) return;
                        e.preventDefault();
                        if (dragOverStatus !== col.status) setDragOverStatus(col.status);
                      }}
                      onDragLeave={() =>
                        setDragOverStatus((s) => (s === col.status ? null : s))
                      }
                      onDrop={(e) => {
                        e.preventDefault();
                        const pieceId = e.dataTransfer.getData("text/plain");
                        const piece = pieces.find((p) => p.id === pieceId);
                        if (piece && isValidDropTarget(piece, col.status)) {
                          handleMove(piece, col.status);
                        }
                        setDraggedPieceId(null);
                        setDragOverStatus(null);
                      }}
                      className={`min-w-0 rounded-2xl border bg-panel min-h-[240px] p-2 space-y-2 shadow-sm transition ${
                        isDragOver ? "border-brand2/60 ring-1 ring-inset ring-brand2/40 bg-brand2/5" : "border-line"
                      }`}
                    >
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                          <h2 className="text-sm font-bold text-text">{col.label}</h2>
                        </div>
                        <span className="text-[11px] font-mono text-text">
                          {selectedClientId !== "all"
                            ? `${colPieces.length}/${filteredPieces.length}`
                            : colPieces.length}
                        </span>
                      </div>

                      {colPieces.length === 0 && (
                        <div className="text-[11px] text-muted italic px-2 py-3 text-center">
                          Sin piezas este mes
                        </div>
                      )}

                      {groups.map((g) => (
                        <div key={g.key}>
                          {selectedClientId === "all" && (
                            <div className="sticky top-0 z-10 -mx-2 mb-1 flex items-center gap-1.5 bg-panel/95 px-2 py-1 backdrop-blur-sm">
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: clientColorMap.get(g.key) ?? defaultClientColor(0),
                                }}
                              />
                              <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted">
                                {g.client?.name ?? "Sin cliente"}
                              </span>
                              <span className="text-[9px] text-muted/50">({g.pieces.length})</span>
                            </div>
                          )}

                          <div className="space-y-1">
                            {g.pieces.map((piece) => {
                              const nextStatus = NEXT_STATUS[piece.status];
                              const prevStatus = PREV_STATUS[piece.status];
                              const isMoving = movingId === piece.id;
                              const typeMeta = TYPE_META[piece.type];
                              const isAdvance = isAdvancePiece(piece);
                              const clientColorHex =
                                clientColorMap.get(piece.client_id ?? "sin-cliente") ?? defaultClientColor(0);
                              const isDragging = draggedPieceId === piece.id;

                              return (
                                <div
                                  key={piece.id}
                                  role="button"
                                  tabIndex={0}
                                  draggable
                                  onDragStart={(e) => {
                                    setDraggedPieceId(piece.id);
                                    e.dataTransfer.setData("text/plain", piece.id);
                                    e.dataTransfer.effectAllowed = "move";
                                  }}
                                  onDragEnd={() => {
                                    setDraggedPieceId(null);
                                    setDragOverStatus(null);
                                  }}
                                  onClick={() => setSelectedPiece(piece)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setSelectedPiece(piece);
                                    }
                                  }}
                                  className={`group relative min-w-0 w-full overflow-hidden rounded-lg border border-line bg-panel2 p-2 space-y-1 shadow-sm cursor-grab active:cursor-grabbing hover:border-brand2/50 transition ${
                                    isDragging ? "opacity-40" : ""
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="min-w-0 flex-1 truncate font-display text-sm font-bold text-text">
                                      {pieceLabel(piece)}
                                    </span>
                                    <span
                                      className="shrink-0 text-[10px] font-medium text-muted"
                                      title={piece.due_date ? "Fecha de entrega" : "Sin fecha de entrega asignada"}
                                    >
                                      {piece.due_date ? formatDay(piece.due_date) : "Sin fecha"}
                                    </span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-muted/70">
                                    {selectedClientId === "all" && (
                                      <span className="inline-flex items-center gap-1" title={piece.client?.name}>
                                        <span
                                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                                          style={{ backgroundColor: clientColorHex }}
                                        />
                                        {clientInitials(piece.client?.name)}
                                      </span>
                                    )}
                                    <span className="inline-flex items-center gap-1">
                                      <typeMeta.Icon className="h-2.5 w-2.5" strokeWidth={2} />
                                      {typeMeta.label}
                                    </span>
                                    {isAdvance && (
                                      <span title={`Grabada antes de tiempo -- pertenece al mes ${piece.month}`}>
                                        Adelantado
                                      </span>
                                    )}
                                  </div>

                                  {(prevStatus || nextStatus) && (
                                    <div className="flex items-center justify-between overflow-hidden max-h-0 opacity-0 mt-0 pt-0 border-t border-transparent group-hover:max-h-6 group-hover:opacity-100 group-hover:mt-1 group-hover:pt-1 group-hover:border-line/60 group-focus-within:max-h-6 group-focus-within:opacity-100 group-focus-within:mt-1 group-focus-within:pt-1 group-focus-within:border-line/60 transition-all duration-150">
                                      {prevStatus ? (
                                        <button
                                          disabled={isMoving}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMove(piece, prevStatus);
                                          }}
                                          className="truncate text-[9px] font-medium text-muted hover:text-text disabled:opacity-40"
                                        >
                                          ← {STATUS_COLUMNS.find((c) => c.status === prevStatus)?.label}
                                        </button>
                                      ) : (
                                        <span />
                                      )}
                                      {nextStatus && (
                                        <button
                                          disabled={isMoving}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMove(piece, nextStatus);
                                          }}
                                          className="truncate text-[9px] font-semibold text-brand2 hover:underline disabled:opacity-40"
                                        >
                                          {STATUS_COLUMNS.find((c) => c.status === nextStatus)?.label} →
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Tabla maestra por cliente */}
          {view === "cliente" && (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-bold font-display text-text">Todas las piezas</h2>
                <span className="text-xs text-muted">
                  {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
                </span>
              </div>

              {loading ? (
                <div className="text-xs text-muted p-4">Cargando piezas...</div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                  {piecesByClient.map((group) => {
                    const key = group.client?.id ?? "sin-cliente";
                    const sort = getClientSort(key);
                    const color = clientColorMap.get(key) ?? defaultClientColor(0);

                    return (
                      <ClientPieceTable
                        key={key}
                        group={group}
                        color={color}
                        sort={sort}
                        onToggleSort={(by) => toggleClientSort(key, by)}
                        onSelectPiece={setSelectedPiece}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ContentPieceModal
        isOpen={!!selectedPiece}
        onClose={() => setSelectedPiece(null)}
        piece={selectedPiece}
        onSave={handleSavePiece}
      />

      <NewPieceModal
        isOpen={isNewPieceOpen}
        onClose={() => setIsNewPieceOpen(false)}
        clients={clients}
        onCreate={handleCreatePiece}
      />
    </div>
  );
}
