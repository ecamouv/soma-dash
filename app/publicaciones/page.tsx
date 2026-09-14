"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ContentPieceModal from "@/components/ContentPieceModal";
import { pieceLabel, type ContentPiece, type Client, type Profile } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { updatePieceStatus, updatePieceDueDateAndName } from "@/lib/deliveries";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function toISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = lunes
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - firstWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function PublicacionesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [month, setMonth] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<ContentPiece | null>(null);
  const [dragOverIso, setDragOverIso] = useState<string | null>(null);

  // Los clientes pausados se filtran por completo: ni sus piezas ni ellos mismos
  // aparecen en ningún lado de Publicaciones (calendario, alertas, selector).
  // Se traen todos los status (no solo aprobado/publicado) porque el calendario
  // también previsualiza -- muted, sin checkmark -- piezas todavía en producción
  // que ya tienen fecha de entrega asignada (ver dayPieces más abajo).
  const loadData = async () => {
    setLoading(true);
    const [piecesRes, clientsRes] = await Promise.all([
      supabase.from("content_pieces").select("*, client:clients(*)"),
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

  useEffect(() => {
    if (!loadingAuth) {
      loadData();
    }
  }, [loadingAuth]);

  const filteredPieces = useMemo(() => {
    if (selectedClientId === "all") return pieces;
    return pieces.filter((p) => p.client_id === selectedClientId);
  }, [pieces, selectedClientId]);

  const piecesByDate = useMemo(() => {
    const map = new Map<string, ContentPiece[]>();
    for (const p of filteredPieces) {
      if (!p.due_date) continue;
      const list = map.get(p.due_date) ?? [];
      list.push(p);
      map.set(p.due_date, list);
    }
    return map;
  }, [filteredPieces]);

  // Piezas aprobadas (revisadas y listas) que aún no tienen fecha de publicación
  // asignada, agrupadas por cliente -- se muestran debajo del calendario para
  // poder darles clic (elegir fecha) o arrastrarlas a un día.
  const unscheduledByClient = useMemo(() => {
    const unscheduled = filteredPieces.filter((p) => p.status === "aprobado" && !p.due_date);
    const groups = new Map<string, { client: Client | undefined; pieces: ContentPiece[] }>();
    for (const p of unscheduled) {
      const key = p.client_id ?? "sin-cliente";
      if (!groups.has(key)) groups.set(key, { client: p.client, pieces: [] });
      groups.get(key)!.pieces.push(p);
    }
    for (const group of groups.values()) {
      group.pieces.sort((a, b) => a.code.localeCompare(b.code));
    }
    return [...groups.values()].sort((a, b) =>
      (a.client?.name ?? "").localeCompare(b.client?.name ?? "")
    );
  }, [filteredPieces]);

  const days = useMemo(() => buildGrid(month), [month]);
  const todayISO = toISO(new Date());

  const handleToggle = async (piece: ContentPiece, checked: boolean) => {
    const newStatus = checked ? "publicado" : "aprobado";
    setSavingId(piece.id);
    setErrorMsg(null);
    try {
      await updatePieceStatus(piece.id, newStatus);
      setPieces((prev) =>
        prev.map((p) => (p.id === piece.id ? { ...p, status: newStatus } : p))
      );
    } catch (err) {
      console.error("Error al actualizar publicación:", err);
      setErrorMsg(
        `No se pudo actualizar ${pieceLabel(piece)}: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleAssignDueDate = async (pieceId: string, dueDate: string | null) => {
    const piece = pieces.find((p) => p.id === pieceId);
    return handleSavePiece(
      pieceId,
      dueDate,
      piece?.display_name ?? null,
      piece?.month ?? new Date().getMonth() + 1
    );
  };

  const handleSavePiece = async (
    pieceId: string,
    dueDate: string | null,
    displayName: string | null,
    month: number
  ) => {
    setErrorMsg(null);
    try {
      await updatePieceDueDateAndName(pieceId, dueDate, displayName, month);
      setPieces((prev) =>
        prev.map((p) =>
          p.id === pieceId ? { ...p, due_date: dueDate, display_name: displayName, month } : p
        )
      );
    } catch (err) {
      console.error("Error al guardar la pieza:", err);
      setErrorMsg(
        `No se pudo guardar la pieza: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const handleDropOnDay = (e: React.DragEvent, iso: string) => {
    e.preventDefault();
    setDragOverIso(null);
    const pieceId = e.dataTransfer.getData("text/plain");
    if (pieceId) handleAssignDueDate(pieceId, iso);
  };

  function changeMonth(delta: number) {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

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
          <div>
            <span className="text-xs text-muted">Operación › Publicaciones</span>
            <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-text to-muted bg-clip-text text-transparent">Publicaciones</h1>
          </div>

          {/* Nota explicativa del checkmark */}
          <div className="rounded-xl border border-line bg-panel2/50 px-4 py-2.5 text-[11px] text-muted">
            Si una pieza tiene <span className="font-semibold text-emerald-400">✓ checkmark</span>, ha sido programado.
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
                onClick={() => setMonth(new Date())}
                className="rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:text-text hover:bg-panel2"
              >
                Hoy
              </button>
              <button
                onClick={() => changeMonth(-1)}
                aria-label="Mes anterior"
                className="rounded-md border border-line px-2.5 py-1.5 text-sm text-muted hover:text-text hover:bg-panel2"
              >
                ‹
              </button>
              <button
                onClick={() => changeMonth(1)}
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

          {/* Calendario mensual */}
          {loading ? (
            <div className="text-xs text-muted p-4">Cargando publicaciones...</div>
          ) : (
            <>
              <div className="overflow-hidden rounded-card border border-line bg-panel shadow-sm">
                <div className="grid grid-cols-7 border-b border-line bg-panel2/40">
                  {WEEKDAYS.map((w) => (
                    <div
                      key={w}
                      className="px-2 py-2 text-center text-[11px] font-medium text-muted"
                    >
                      {w}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {days.map((d) => {
                    const iso = toISO(d);
                    const inMonth = d.getMonth() === month.getMonth();
                    const isToday = iso === todayISO;
                    const dayPieces = piecesByDate.get(iso) ?? [];
                    const isDragOver = dragOverIso === iso;

                    return (
                      <div
                        key={iso}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverIso !== iso) setDragOverIso(iso);
                        }}
                        onDragLeave={() =>
                          setDragOverIso((cur) => (cur === iso ? null : cur))
                        }
                        onDrop={(e) => handleDropOnDay(e, iso)}
                        className={[
                          "flex min-h-[104px] max-h-[160px] flex-col gap-1 overflow-y-auto border-b border-r border-line px-1.5 py-1.5 transition",
                          inMonth ? "bg-transparent" : "bg-black/20",
                          isDragOver ? "bg-orange-500/10 ring-1 ring-inset ring-orange-500/50" : "",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "mb-0.5 inline-flex h-5 w-5 items-center justify-center self-start rounded-full text-[11px]",
                            isToday
                              ? "bg-brand text-white font-semibold"
                              : inMonth
                              ? "text-text"
                              : "text-muted/40",
                          ].join(" ")}
                        >
                          {d.getDate()}
                        </span>

                        {dayPieces.map((piece) => {
                          const isPublished = piece.status === "publicado";
                          // Lista para publicar: puede marcarse con el checkmark. Todo lo
                          // demás (por_grabar/en_edicion/revision) es solo una previsualización
                          // -- aún en producción, sin checkmark -- hasta que llegue a "aprobado"
                          // desde Entregas.
                          const isSelectable = piece.status === "aprobado" || isPublished;
                          const Wrapper = isSelectable ? "label" : "div";

                          return (
                            <Wrapper
                              key={piece.id}
                              draggable={!isPublished}
                              onDragStart={(e) => {
                                if (isPublished) {
                                  e.preventDefault();
                                  return;
                                }
                                e.dataTransfer.setData("text/plain", piece.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              title={
                                isPublished
                                  ? "Ya publicado: no se puede reagendar arrastrando"
                                  : isSelectable
                                  ? "Arrastra a otro día para cambiar su fecha de entrega"
                                  : "Todavía en producción -- arrastra para cambiar su fecha de entrega. Podrá marcarse como publicada cuando esté aprobada."
                              }
                              className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] leading-tight ${
                                isPublished
                                  ? "bg-emerald-500/10 text-emerald-300 cursor-pointer"
                                  : isSelectable
                                  ? "bg-teal-500/10 text-teal-300 cursor-grab active:cursor-grabbing"
                                  : "bg-white/[0.02] text-muted/30 cursor-grab active:cursor-grabbing"
                              }`}
                            >
                              {isSelectable && (
                                <input
                                  type="checkbox"
                                  checked={isPublished}
                                  disabled={savingId === piece.id}
                                  onChange={(e) => handleToggle(piece, e.target.checked)}
                                  className="h-3 w-3 accent-emerald-500"
                                />
                              )}
                              <span className="font-mono truncate">{pieceLabel(piece)}</span>
                              <span className="truncate opacity-70">
                                {piece.client?.name}
                              </span>
                            </Wrapper>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Aprobadas sin fecha de publicación: debajo del calendario, por cliente.
                  Clic para elegir fecha, o arrastrar directo a un día del calendario. */}
              {unscheduledByClient.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-text">
                    Aprobadas sin fecha de publicación
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                    {unscheduledByClient.map((group) => (
                      <div
                        key={group.client?.id ?? "sin-cliente"}
                        className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-3 space-y-2 shadow-sm"
                      >
                        <h3 className="text-xs font-bold text-orange-400 px-1">
                          {group.client?.name ?? "Sin cliente"} ({group.pieces.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {group.pieces.map((piece) => (
                            <div
                              key={piece.id}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", piece.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={() => setSelectedPiece(piece)}
                              title="Clic para elegir fecha, o arrastra a un día del calendario"
                              className="flex items-center gap-1.5 rounded-md border border-orange-500/40 bg-panel2 px-2.5 py-1.5 text-xs cursor-grab active:cursor-grabbing hover:border-orange-400 transition"
                            >
                              <span className="font-mono font-semibold text-orange-300">
                                {pieceLabel(piece)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ContentPieceModal
        isOpen={!!selectedPiece}
        onClose={() => setSelectedPiece(null)}
        piece={selectedPiece}
        onSave={handleSavePiece}
      />
    </div>
  );
}
