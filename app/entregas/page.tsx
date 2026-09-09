"use client";

import { useState, useEffect, useMemo } from "react";
import { LuChevronUp, LuChevronDown, LuChevronsUpDown } from "react-icons/lu";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ContentPieceModal from "@/components/ContentPieceModal";
import NewPieceModal from "@/components/NewPieceModal";
import { pieceLabel, type ContentPiece, type Client, type PieceStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  updatePieceStatus,
  updatePieceDueDateAndName,
  createContentPiece,
  nextCodeNumbers,
  buildPieceCode,
} from "@/lib/deliveries";

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

// Paleta rotativa para distinguir la tabla de cada cliente en "Todas las piezas".
const CLIENT_COLOR_PALETTE: { bg: string; text: string; border: string }[] = [
  { bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-500/30" },
  { bg: "bg-rose-500/10", text: "text-rose-300", border: "border-rose-500/30" },
  { bg: "bg-violet-500/10", text: "text-violet-300", border: "border-violet-500/30" },
  { bg: "bg-amber-500/10", text: "text-amber-300", border: "border-amber-500/30" },
  { bg: "bg-teal-500/10", text: "text-teal-300", border: "border-teal-500/30" },
  { bg: "bg-fuchsia-500/10", text: "text-fuchsia-300", border: "border-fuchsia-500/30" },
  { bg: "bg-orange-500/10", text: "text-orange-300", border: "border-orange-500/30" },
  { bg: "bg-cyan-500/10", text: "text-cyan-300", border: "border-cyan-500/30" },
];

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

export default function DeliveriesPage() {
  const supabase = createClient();
  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<ContentPiece | null>(null);
  const [isNewPieceOpen, setIsNewPieceOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Orden de la tabla "Todas las piezas", independiente por cliente (clave = client_id).
  const [clientSort, setClientSort] = useState<
    Record<string, { by: "code" | "due_date"; dir: "asc" | "desc" }>
  >({});

  const getClientSort = (key: string) => clientSort[key] ?? { by: "code" as const, dir: "asc" as const };

  const toggleClientSort = (key: string, by: "code" | "due_date") => {
    setClientSort((prev) => {
      const current = prev[key] ?? { by: "code" as const, dir: "asc" as const };
      const nextDir: "asc" | "desc" =
        current.by === by && current.dir === "asc" ? "desc" : "asc";
      return { ...prev, [key]: { by, dir: nextDir } };
    });
  };

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
    loadData();
  }, []);

  const clientFilteredPieces = useMemo(() => {
    if (selectedClientId === "all") return pieces;
    return pieces.filter((p) => p.client_id === selectedClientId);
  }, [pieces, selectedClientId]);

  // Solo entran a la grilla las piezas con un evento de grabación ligado (event_id).
  // Si además tienen fecha de entrega manual, esa manda; si no, se ubican por la fecha
  // del evento. Una pieza con fecha de entrega pero SIN evento ligado no entra aquí —
  // se queda únicamente en la alerta de "sin fecha de grabación" de abajo.
  const filteredPieces = useMemo(() => {
    return clientFilteredPieces.filter((p) => {
      if (p.status === "publicado") return false;
      if (!p.event_id) return false;
      const date = pieceDate(p);
      if (!date) return false;
      if (date < monthStartISO || date > monthEndISO) return false;
      return true;
    });
  }, [clientFilteredPieces, monthStartISO, monthEndISO]);

  // Piezas sin evento de grabación ligado: no tienen de dónde sacar una fecha, así que
  // se muestran aparte para poder abrirlas y al menos asignarles una fecha de entrega a mano.
  const unscheduledPieces = useMemo(() => {
    return clientFilteredPieces.filter((p) => p.status !== "publicado" && !p.event_id);
  }, [clientFilteredPieces]);

  // Tabla maestra: todas las piezas de todos los clientes, sin filtrar por mes/cliente,
  // agrupadas en una tabla separada por cliente. El orden de cada tabla se aplica al
  // renderizar (ver clientSort/toggleClientSort), independiente por cliente.
  const piecesByClient = useMemo(() => {
    const groups = new Map<string, { client: Client | undefined; pieces: ContentPiece[] }>();
    for (const p of pieces) {
      const key = p.client_id ?? "sin-cliente";
      if (!groups.has(key)) groups.set(key, { client: p.client, pieces: [] });
      groups.get(key)!.pieces.push(p);
    }
    return [...groups.values()].sort((a, b) =>
      (a.client?.name ?? "").localeCompare(b.client?.name ?? "")
    );
  }, [pieces]);

  const piecesByStatus = useMemo(() => {
    const map = new Map<PieceStatus, ContentPiece[]>();
    for (const col of STATUS_COLUMNS) map.set(col.status, []);
    for (const p of filteredPieces) {
      map.get(p.status)?.push(p);
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

  const handleSavePiece = async (
    pieceId: string,
    dueDate: string | null,
    displayName: string | null
  ) => {
    setErrorMsg(null);
    try {
      await updatePieceDueDateAndName(pieceId, dueDate, displayName);
      setPieces((prev) =>
        prev.map((p) =>
          p.id === pieceId ? { ...p, due_date: dueDate, display_name: displayName } : p
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
  }) => {
    const month = input.dueDate
      ? Number(input.dueDate.split("-")[1])
      : new Date().getMonth() + 1;

    const existingCodes = pieces
      .filter((p) => p.client_id === input.clientId)
      .map((p) => p.code);
    const [n] = nextCodeNumbers(existingCodes, input.type, month, 1);
    const code = buildPieceCode(month, input.type, n);

    const created = await createContentPiece({
      clientId: input.clientId,
      code,
      type: input.type,
      month,
      dueDate: input.dueDate,
    });
    setPieces((prev) => [...prev, created]);
  };

  return (
    <div className="flex h-screen text-text">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto bg-ink">
        <TopBar
          profile={{
            id: "admin",
            email: "admin@soma.mx",
            full_name: "Admin Soma",
            role: "admin",
            initials: "AS",
          }}
        />

        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <span className="text-xs text-muted">Operación › Entregas</span>
            <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-text to-muted bg-clip-text text-transparent">Entregas</h1>
          </div>

          {errorMsg && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              <span>{errorMsg}</span>
              <button
                onClick={() => setErrorMsg(null)}
                className="shrink-0 text-red-300 hover:text-red-100"
              >
                ✕
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
              <h2 className="text-xs font-bold uppercase text-amber-400 px-1">
                Sin fecha de grabación ({unscheduledPieces.length}) 
              </h2>
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
            </div>
          )}

          {/* Kanban - vista de piezas en Entregas */}
          {loading ? (
            <div className="text-xs text-muted p-4">Cargando piezas...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {STATUS_COLUMNS.map((col) => {
                const colPieces = piecesByStatus.get(col.status) ?? [];
                return (
                  <div
                    key={col.status}
                    className="rounded-2xl border border-line bg-panel p-3 space-y-3 min-h-[240px] shadow-sm"
                  >
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                        <h2 className="text-sm font-bold text-text">{col.label}</h2>
                      </div>
                      <span className="text-[11px] font-mono text-text">
                        {colPieces.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {colPieces.length === 0 && (
                        <div className="text-[11px] text-muted italic px-2 py-3 text-center">
                          Sin piezas este mes
                        </div>
                      )}

                      {colPieces.map((piece) => {
                        const nextStatus = NEXT_STATUS[piece.status];
                        const prevStatus = PREV_STATUS[piece.status];
                        const isMoving = movingId === piece.id;

                        return (
                          <div
                            key={piece.id}
                            onClick={() => setSelectedPiece(piece)}
                            className={`rounded-xl border bg-panel2 p-2.5 space-y-1.5 shadow-sm cursor-pointer hover:border-brand2/60 transition ${col.border}`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="font-mono text-text truncate">{pieceLabel(piece)}</span>
                              <span className="font-mono text-muted/50 truncate">{piece.type === "v" ? "Video" : "Foto"}</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${col.bg} ${col.text}`}
                                title={piece.due_date ? "Fecha de entrega" : "Sin fecha de entrega asignada"}
                              >
                                {piece.due_date ? formatDay(piece.due_date) : "Sin fecha"}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted truncate">
                              {piece.client?.name ?? "Sin cliente"}
                            </div>

                            {(prevStatus || nextStatus) && (
                              <div className="flex items-center justify-between pt-1.5 border-t border-line/60">
                                {prevStatus ? (
                                  <button
                                    disabled={isMoving}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMove(piece, prevStatus);
                                    }}
                                    className="text-[10px] font-medium text-muted hover:text-text disabled:opacity-40"
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
                                    className="text-[10px] font-semibold text-brand2 hover:underline disabled:opacity-40"
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
                );
              })}
            </div>
          )}

          {/* Tabla maestra por cliente */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold font-display text-text">Todas las piezas</h2>
              <button
                onClick={() => setIsNewPieceOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow"
              >
                + Nueva pieza
              </button>
            </div>

            {loading ? (
              <div className="text-xs text-muted p-4">Cargando piezas...</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                {piecesByClient.map((group, i) => {
                  const color = CLIENT_COLOR_PALETTE[i % CLIENT_COLOR_PALETTE.length];
                  const key = group.client?.id ?? "sin-cliente";
                  const sort = getClientSort(key);
                  const sortedPieces = [...group.pieces].sort((a, b) =>
                    comparePieces(a, b, sort.by, sort.dir)
                  );

                  const SortIcon = ({ column }: { column: "code" | "due_date" }) => {
                    if (sort.by !== column) {
                      return <LuChevronsUpDown className="h-3 w-3 opacity-50" />;
                    }
                    return sort.dir === "asc" ? (
                      <LuChevronUp className="h-3 w-3" />
                    ) : (
                      <LuChevronDown className="h-3 w-3" />
                    );
                  };

                  return (
                    <div
                      key={key}
                      className={`overflow-hidden rounded-2xl border ${color.border} bg-panel shadow-sm`}
                    >
                      <div className={`px-4 py-2.5 ${color.bg} border-b ${color.border}`}>
                        <h3 className={`text-sm font-bold ${color.text}`}>
                          {group.client?.name ?? "Sin cliente"} ({group.pieces.length})
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-line bg-panel2/40 text-left text-muted">
                              <th className="px-4 py-2.5 font-medium">
                                <button
                                  onClick={() => toggleClientSort(key, "code")}
                                  className="flex items-center gap-1 hover:text-text"
                                >
                                  Pieza <SortIcon column="code" />
                                </button>
                              </th>
                              <th className="px-4 py-2.5 font-medium">Tipo</th>
                              <th className="px-4 py-2.5 font-medium">
                                <button
                                  onClick={() => toggleClientSort(key, "due_date")}
                                  className="flex items-center gap-1 hover:text-text"
                                >
                                  Entrega <SortIcon column="due_date" />
                                </button>
                              </th>
                              <th className="px-4 py-2.5 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedPieces.map((piece) => {
                              const meta = ALL_STATUS_META[piece.status] ?? {
                                label: piece.status,
                                bg: "bg-zinc-500/10",
                                text: "text-zinc-400",
                              };
                              return (
                                <tr
                                  key={piece.id}
                                  onClick={() => setSelectedPiece(piece)}
                                  className="border-b border-line/60 last:border-0 cursor-pointer hover:bg-panel2/40"
                                >
                                  <td className="px-4 py-2 font-mono font-semibold text-text">{pieceLabel(piece)}</td>
                                  <td className="px-4 py-2 text-muted">{piece.type === "v" ? "Video" : "Foto"}</td>
                                  <td className="px-4 py-2 text-muted">
                                    {piece.due_date ? formatDay(piece.due_date) : "—"}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${meta.bg} ${meta.text}`}
                                    >
                                      {meta.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
