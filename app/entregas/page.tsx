"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { LuChevronUp, LuChevronDown, LuChevronsUpDown, LuChevronRight, LuVideo, LuCamera, LuMaximize2, LuMinimize2, LuLightbulb } from "react-icons/lu";
import ContentPieceModal from "@/components/ContentPieceModal";
import NewPieceModal from "@/components/NewPieceModal";
import { ErrorBanner, MonthNav, PageHeader, PageShell, SessionLoading } from "@/components/ui";
import { pieceLabel, type ContentPiece, type Client, type PieceStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { updateContentPiece, createContentPiece, consumeBlankPlaceholder, deleteContentPiece } from "@/lib/deliveries";
import { buildClientColorMap, defaultClientColor, hexToRgba } from "@/lib/clientColors";
import { pieceDate } from "@/lib/weekly";
import { useSession } from "@/lib/useSession";
import { useStoredState } from "@/lib/useStoredState";
import {
  MONTH_NAMES,
  addMonths,
  buildPieceCode,
  byDateNullsLast,
  errText,
  groupBy,
  isAheadOf,
  iso,
  nextCodeNumbers,
} from "@/lib/utils";

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

function formatDay(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

// "Adelantado": se calcula, no se guarda -- compara el mes en que realmente se grabó
// (el mes del evento de grabación ligado) contra el mes al que pertenece la pieza
// (piece.month, su categorización de paquete). Si se grabó antes de su mes, es una
// pieza adelantada. Cubre el cruce diciembre -> enero; no contempla saltos de año
// más raros porque piece.month tampoco guarda año en ningún otro lado del sistema.
function isAdvancePiece(piece: ContentPiece): boolean {
  if (!piece.event?.event_date) return false;
  const eventMonth = Number(piece.event.event_date.slice(5, 7));
  return !!eventMonth && isAheadOf(piece.month, eventMonth);
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
  return [...groupBy(pieces, (p) => p.client_id ?? "sin-cliente").entries()]
    .map(([key, list]) => ({ key, client: list[0].client, pieces: list }))
    .sort((a, b) => byDateNullsLast(a.pieces[0].due_date, b.pieces[0].due_date));
}

function comparePieces(
  a: ContentPiece,
  b: ContentPiece,
  by: "code" | "due_date",
  dir: "asc" | "desc"
): number {
  const byCode = a.code.localeCompare(b.code);
  const cmp = by === "due_date" ? byDateNullsLast(a.due_date, b.due_date) || byCode : byCode;
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

// Solo visual: fondo blanco suave si la pieza es para hoy, tinte crimson si ya se pasó la fecha.
function dueHighlight(piece: ContentPiece): string {
  if (!piece.due_date || piece.status === "publicado") return "";
  const today = iso(new Date());
  if (piece.due_date < today) return "!border-[rgb(255_77_109/0.5)] !bg-[rgb(255_77_109/0.12)]";
  if (piece.due_date === today) return "!border-white/[0.5] !bg-white/[0.15]";
  return "";
}

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
  const currentUser = useSession();

  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  // Lista completa (con pausados) solo para calcular colores igual que en Clientes.
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [month, setMonth] = useState<Date>(() => addMonths(new Date(), 0));
  // Foquito de la barra del mes: activa el resaltado de piezas de hoy y atrasadas.
  const [showDueHighlight, setShowDueHighlight] = useState(false);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<ContentPiece | null>(null);
  const [isNewPieceOpen, setIsNewPieceOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Vista activa (kanban o tabla por cliente) y colapsos, recordados en este navegador.
  const [view, setView] = useStoredState<"kanban" | "cliente">("entregas:view", "kanban");
  const [unscheduledCollapsed, setUnscheduledCollapsed] = useStoredState("entregas:unscheduledCollapsed", false);
  // Colapso por cliente dentro de cada columna del kanban. Clave "status:clientId".
  const [collapsedGroups, setCollapsedGroups] = useStoredState<string[]>("entregas:kanbanCollapsedGroups", []);
  // Arrastrar-y-soltar entre columnas del kanban: solo permite el mismo salto de un
  // paso que ya permiten los botones ← / → (NEXT_STATUS/PREV_STATUS), para no saltarse
  // etapas del pipeline arrastrando.
  const [draggedPieceId, setDraggedPieceId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<PieceStatus | null>(null);
  // Orden de la tabla "Todas las piezas", independiente por cliente (clave = client_id).
  const [clientSort, setClientSort] = useState<
    Record<string, { by: "code" | "due_date"; dir: "asc" | "desc" }>
  >({});

  const getClientSort = (key: string) => clientSort[key] ?? { by: "code" as const, dir: "asc" as const };

  const toggleGroupCollapsed = (groupKey: string) =>
    setCollapsedGroups((prev) =>
      prev.includes(groupKey) ? prev.filter((k) => k !== groupKey) : [...prev, groupKey]
    );

  const toggleClientSort = (key: string, by: "code" | "due_date") => {
    setClientSort((prev) => {
      const current = prev[key] ?? { by: "code" as const, dir: "asc" as const };
      const nextDir: "asc" | "desc" =
        current.by === by && current.dir === "asc" ? "desc" : "asc";
      return { ...prev, [key]: { by, dir: nextDir } };
    });
  };

  const monthStartISO = iso(month);
  const monthEndISO = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0));

  // Los clientes pausados se filtran por completo: ni sus piezas ni ellos mismos
  // aparecen en ningún lado de Entregas (kanban, alertas, tabla maestra, selector).
  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();
    const [piecesRes, clientsRes] = await Promise.all([
      supabase.from("content_pieces").select("*, client:clients(*), event:events(event_date)"),
      supabase.from("clients").select("*").order("name"),
    ]);

    if (piecesRes.data) {
      setPieces((piecesRes.data as ContentPiece[]).filter((p) => !p.client?.paused));
    }
    if (clientsRes.data) {
      setAllClients(clientsRes.data as Client[]);
      setClients((clientsRes.data as Client[]).filter((c) => !c.paused));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

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
  // grabación ligado): se muestran aparte para poder asignarles una fecha a mano, pero
  // solo las del mes seleccionado (piece.month). Si no hay ninguna, el bloque se oculta.
  const unscheduledPieces = useMemo(() => {
    const selectedMonth = month.getMonth() + 1;
    return clientFilteredPieces.filter(
      (p) => p.status !== "publicado" && !pieceDate(p) && p.month === selectedMonth
    );
  }, [clientFilteredPieces, month]);

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
    return [...groupBy(inMonth, (p) => p.client_id ?? "sin-cliente").values()]
      .map((pieces) => ({ client: pieces[0].client, pieces }))
      .sort((a, b) => (a.client?.name ?? "").localeCompare(b.client?.name ?? ""));
  }, [clientFilteredPieces, monthStartISO, monthEndISO]);

  // Color por cliente para la franja del kanban y el encabezado de "Todas las
  // piezas": el que se asignó a mano en Clientes (client.color) o si no, la paleta
  // automática por índice. Se calcula sobre `clients` (orden alfabético estable) y
  // no sobre piecesByClient, que ahora varía con el mes: si saliera de ahí, un
  // cliente podría cambiar de color entre meses según quién más tenga piezas ese mes.
  const clientColorMap = useMemo(() => buildClientColorMap(allClients), [allClients]);

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
    for (const list of map.values()) list.sort((a, b) => byDateNullsLast(a.due_date, b.due_date));
    return map;
  }, [filteredPieces]);

  const handleMove = async (piece: ContentPiece, newStatus: PieceStatus) => {
    setMovingId(piece.id);
    setErrorMsg(null);
    try {
      await updateContentPiece({ pieceId: piece.id, status: newStatus });
      setPieces((prev) =>
        prev.map((p) => (p.id === piece.id ? { ...p, status: newStatus } : p))
      );
    } catch (err) {
      console.error("Error al mover la pieza:", err);
      setErrorMsg(
        `No se pudo mover ${pieceLabel(piece)} a "${ALL_STATUS_META[newStatus]?.label ?? newStatus}": ${errText(err)}`
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
      await updateContentPiece({ pieceId, dueDate, displayName, month: pieceMonth });
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
        `No se pudo guardar la pieza: ${errText(err)}`
      );
      throw err;
    }
  };

  const handleDeletePiece = async (pieceId: string) => {
    setErrorMsg(null);
    try {
      await deleteContentPiece(pieceId);
      setPieces((prev) => prev.filter((p) => p.id !== pieceId));
    } catch (err) {
      console.error("Error al borrar la pieza:", err);
      setErrorMsg(`No se pudo borrar la pieza: ${errText(err)}`);
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
    if (isAheadOf(input.month, new Date().getMonth() + 1)) {
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

  if (!currentUser) return <SessionLoading />;

  return (
    <PageShell profile={currentUser}>
        <div className="p-6 space-y-6">
          <PageHeader
            crumb="Operación › Entregas"
            title="Entregas"
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-line bg-panel p-0.5">
                <button
                  type="button"
                  onClick={() => setView("kanban")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    view === "kanban" ? "bg-panel2 text-text shadow-sm" : "text-muted hover:text-text"
                  }`}
                >
                  Kanban
                </button>
                <button
                  type="button"
                  onClick={() => setView("cliente")}
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
          </PageHeader>

          <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} />

          {/* Filtros: mes y cliente */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3 shadow-sm">
            <MonthNav
              month={month}
              onChange={setMonth}
              label={`${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`}
            >
              <button
                type="button"
                onClick={() => setShowDueHighlight((v) => !v)}
                aria-pressed={showDueHighlight}
                aria-label="Resaltar piezas de hoy y atrasadas"
                title="Resaltar piezas de hoy y atrasadas"
                className="ml-1 rounded-md p-1.5 text-muted hover:bg-panel2"
              >
                <LuLightbulb
                  className="h-4 w-4"
                  style={
                    showDueHighlight
                      ? { color: "var(--color-crimson)", fill: "var(--color-crimson)" }
                      : undefined
                  }
                />
              </button>
            </MonthNav>

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
                onClick={() => setUnscheduledCollapsed((v) => !v)}
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

                      {groups.map((g) => {
                        const groupKey = `${col.status}:${g.key}`;
                        const isGroupCollapsed =
                          selectedClientId === "all" && collapsedGroups.includes(groupKey);
                        const groupColor = clientColorMap.get(g.key) ?? defaultClientColor(0);
                        return (
                        <div key={g.key}>
                          {selectedClientId === "all" && (
                            <button
                              type="button"
                              onClick={() => toggleGroupCollapsed(groupKey)}
                              aria-expanded={!isGroupCollapsed}
                              className="sticky top-0 z-10 -mx-2 mb-1 flex w-[calc(100%+1rem)] items-center gap-1.5 bg-panel/95 px-2 py-1 text-left backdrop-blur-sm"
                            >
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: groupColor }}
                              />
                              <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted">
                                {g.client?.name ?? "Sin cliente"}
                              </span>
                              <span className="text-[9px] text-muted/50">({g.pieces.length})</span>
                              <LuChevronRight
                                className={`h-3 w-3 shrink-0 text-muted transition-transform ${
                                  isGroupCollapsed ? "" : "rotate-90"
                                }`}
                              />
                            </button>
                          )}

                          {!isGroupCollapsed && (
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
                                  className={`group relative min-w-0 w-full overflow-hidden rounded-lg border border-line bg-panel2 p-2 space-y-1 shadow-sm cursor-grab active:cursor-grabbing hover:border-brand2/50 transition-none ${
                                    isDragging ? "opacity-40" : ""
                                  } ${showDueHighlight ? dueHighlight(piece) : ""}`}
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
                          )}
                        </div>
                        );
                      })}
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

      <ContentPieceModal
        isOpen={!!selectedPiece}
        onClose={() => setSelectedPiece(null)}
        piece={selectedPiece}
        onSave={handleSavePiece}
        onDelete={handleDeletePiece}
      />

      <NewPieceModal
        isOpen={isNewPieceOpen}
        onClose={() => setIsNewPieceOpen(false)}
        clients={clients}
        onCreate={handleCreatePiece}
      />
    </PageShell>
  );
}
