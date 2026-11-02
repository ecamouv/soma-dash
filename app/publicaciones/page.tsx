"use client";

import { useState, useEffect, useMemo } from "react";
import { useEffectiveRole } from "@/lib/roleView";
import ContentPieceModal from "@/components/ContentPieceModal";
import PautaSection from "@/components/PautaSection";
import { updatePautaPost, type PautaPost } from "@/lib/pauta";
import { ErrorBanner, MonthNav, PageHeader, PageShell, SessionLoading } from "@/components/ui";
import { pieceLabel, type ContentPiece, type Client } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { updateContentPiece, deleteContentPiece } from "@/lib/deliveries";
import { useSession } from "@/lib/useSession";
import { MONTH_NAMES, WEEKDAYS, buildGrid, errText, groupBy, iso as toISO } from "@/lib/utils";

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function PublicacionesPage() {
  const currentUser = useSession();
  const role = useEffectiveRole(currentUser?.role);

  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  // Día seleccionado (clic en el fondo de una casilla) para la lista lateral.
  const [selectedIso, setSelectedIso] = useState<string>(() => toISO(new Date()));
  const [clients, setClients] = useState<Client[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [month, setMonth] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<ContentPiece | null>(null);
  const [dragOverIso, setDragOverIso] = useState<string | null>(null);
  // Posts de clientes de pauta, compartidos entre el calendario y la sección de pauta.
  const [pautaPosts, setPautaPosts] = useState<PautaPost[]>([]);

  // Los clientes pausados se filtran por completo: ni sus piezas ni ellos mismos
  // aparecen en ningún lado de Publicaciones (calendario, alertas, selector).
  // Se traen todos los status (no solo aprobado/publicado) porque el calendario
  // también previsualiza -- muted, sin checkmark -- piezas todavía en producción
  // que ya tienen fecha de entrega asignada (ver dayPieces más abajo).
  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();
    const [piecesRes, clientsRes] = await Promise.all([
      supabase.from("content_pieces").select("*, client:clients(*)"),
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

  const filteredPieces = useMemo(() => {
    if (selectedClientId === "all") return pieces;
    return pieces.filter((p) => p.client_id === selectedClientId);
  }, [pieces, selectedClientId]);

  const piecesByDate = useMemo(
    () => groupBy(filteredPieces.filter((p) => p.due_date), (p) => p.due_date!),
    [filteredPieces]
  );

  // Piezas aprobadas (revisadas y listas) que aún no tienen fecha de publicación
  // asignada, agrupadas por cliente -- se muestran debajo del calendario para
  // poder darles clic (elegir fecha) o arrastrarlas a un día.
  const unscheduledByClient = useMemo(() => {
    const unscheduled = filteredPieces.filter((p) => p.status === "aprobado" && !p.due_date);
    return [...groupBy(unscheduled, (p) => p.client_id ?? "sin-cliente").values()]
      .map((pieces) => ({
        client: pieces[0].client,
        pieces: pieces.sort((a, b) => a.code.localeCompare(b.code)),
      }))
      .sort((a, b) => (a.client?.name ?? "").localeCompare(b.client?.name ?? ""));
  }, [filteredPieces]);

  // Clientes con paquete "Solamente Pauta"
  // Los productores no ven clientes de pauta (ni su sección, ni sus posts en el calendario).
  const hidePauta = role === "prod";
  const pautaClients = useMemo(
    () =>
      hidePauta
        ? []
        : clients.filter(
            (c) => c.package === "solamente_pauta" && (selectedClientId === "all" || c.id === selectedClientId)
          ),
    [clients, selectedClientId, hidePauta]
  );

  const days = useMemo(() => buildGrid(month), [month]);

  const pautaByDate = useMemo(() => {
    const allowed = new Map(pautaClients.map((c) => [c.id, c.name]));
    const visible = pautaPosts
      .filter((p) => allowed.has(p.client_id) && p.scheduled_date)
      .map((p) => ({ ...p, clientName: allowed.get(p.client_id)! }));
    return groupBy(visible, (p) => p.scheduled_date!);
  }, [pautaPosts, pautaClients]);
  const todayISO = toISO(new Date());

  const selectedPieces = piecesByDate.get(selectedIso) ?? [];
  const selectedPauta = pautaByDate.get(selectedIso) ?? [];
  const [selY, selM, selD] = selectedIso.split("-").map(Number);
  const selectedHeader = `${DAY_NAMES[(new Date(selY, selM - 1, selD).getDay() + 6) % 7]} ${selD}`;

  const handleToggle = async (piece: ContentPiece, checked: boolean) => {
    const newStatus = checked ? "publicado" : "aprobado";
    setSavingId(piece.id);
    setErrorMsg(null);
    try {
      await updateContentPiece({ pieceId: piece.id, status: newStatus });
      setPieces((prev) =>
        prev.map((p) => (p.id === piece.id ? { ...p, status: newStatus } : p))
      );
    } catch (err) {
      console.error("Error al actualizar publicación:", err);
      setErrorMsg(
        `No se pudo actualizar ${pieceLabel(piece)}: ${errText(err)}`
      );
    } finally {
      setSavingId(null);
    }
  };

  const handlePautaToggle = async (post: PautaPost, checked: boolean) => {
    setSavingId(post.id);
    setErrorMsg(null);
    try {
      await updatePautaPost(post.id, { published: checked });
      setPautaPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, published: checked } : p)));
    } catch (err) {
      console.error("Error al actualizar post de pauta:", err);
      setErrorMsg(
        `No se pudo actualizar ${post.name}: ${errText(err)}`
      );
    } finally {
      setSavingId(null);
    }
  };

  // Reagendar (drag-and-drop a otro día) cambia exclusivamente la fecha de entrega --
  // a diferencia del modal de edición, aquí no hay un selector de "mes al que
  // pertenece" de por medio, así que el mes se recalcula automáticamente a partir
  // de la nueva fecha en vez de conservar el mes anterior.
  const handleAssignDueDate = async (pieceId: string, dueDate: string | null) => {
    const piece = pieces.find((p) => p.id === pieceId);
    const month = dueDate
      ? Number(dueDate.slice(5, 7))
      : piece?.month ?? new Date().getMonth() + 1;
    return handleSavePiece(pieceId, dueDate, piece?.display_name ?? null, month);
  };

  const handleSavePiece = async (
    pieceId: string,
    dueDate: string | null,
    displayName: string | null,
    month: number
  ) => {
    setErrorMsg(null);
    try {
      await updateContentPiece({ pieceId, dueDate, displayName, month });
      setPieces((prev) =>
        prev.map((p) =>
          p.id === pieceId ? { ...p, due_date: dueDate, display_name: displayName, month } : p
        )
      );
    } catch (err) {
      console.error("Error al guardar la pieza:", err);
      setErrorMsg(
        `No se pudo guardar la pieza: ${errText(err)}`
      );
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

  const handleDropOnDay = (e: React.DragEvent, iso: string) => {
    e.preventDefault();
    setDragOverIso(null);
    const pieceId = e.dataTransfer.getData("text/plain");
    if (pieceId) handleAssignDueDate(pieceId, iso);
  };

  if (!currentUser) return <SessionLoading />;

  return (
    <PageShell profile={currentUser}>
        <div className="p-6 space-y-6">
          <PageHeader crumb="Operación › Publicaciones" title="Publicaciones" />

          {/* Nota explicativa del checkmark */}
          <div className="rounded-xl border border-line bg-panel2/50 px-4 py-2.5 text-[11px] text-muted">
            Si una pieza tiene <span className="font-semibold text-emerald-400">✓ checkmark</span>, ha sido programado.
          </div>

          <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} />

          {/* Filtros: mes y cliente */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3 shadow-sm">
            <MonthNav
              month={month}
              onChange={setMonth}
              label={`${MONTH_NAMES[month.getMonth()]} ${month.getFullYear()}`}
            />

            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="rounded-xl border border-line bg-panel2 px-3 py-1.5 text-xs text-text focus:border-brand2 focus:outline-none transition"
            >
              <option value="all">Todos los clientes</option>
              {clients
                .filter((c) => !(hidePauta && c.package === "solamente_pauta"))
                .map((c) => (
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
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1 overflow-hidden rounded-card border border-line bg-panel shadow-sm">
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
                    const dayPauta = pautaByDate.get(iso) ?? [];
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
                        onClick={(e) => {
                          // Solo el fondo de la casilla selecciona el día; las piezas y sus casillas no.
                          if ((e.target as HTMLElement).closest("label, input, [draggable='true']")) return;
                          setSelectedIso(iso);
                        }}
                        className={[
                          "flex min-h-[104px] max-h-[160px] cursor-pointer flex-col gap-1 overflow-y-auto border-b border-r border-line px-1.5 py-1.5 transition",
                          iso === selectedIso ? "bg-panel2/60 ring-1 ring-inset ring-brand/60" : inMonth ? "bg-transparent" : "bg-ink/40",
                          isDragOver ? "bg-orange-500/10 ring-1 ring-inset ring-orange-500/50" : "",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "mb-0.5 inline-flex h-5 w-5 items-center justify-center self-start rounded-full text-[11px]",
                            isToday
                              ? "bg-brand text-on-primary font-semibold"
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
                                  : "bg-panel2/50 text-muted/30 cursor-grab active:cursor-grabbing"
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

                        {dayPauta.map((post) => (
                          <label
                            key={post.id}
                            title="Post de pauta"
                            className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-[10px] leading-tight cursor-pointer ${
                              post.published
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "bg-teal-500/10 text-teal-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={post.published}
                              disabled={savingId === post.id}
                              onChange={(e) => handlePautaToggle(post, e.target.checked)}
                              className="h-3 w-3 accent-emerald-500"
                            />
                            <span className="font-mono truncate">{post.name}</span>
                            <span className="truncate opacity-70">{post.clientName}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lista lateral del día seleccionado: solo nombre y cliente. */}
              <aside className="w-full shrink-0 rounded-card border border-line bg-panel p-4 shadow-sm lg:sticky lg:top-4 lg:w-64">
                <h2 className="mb-3 font-display text-sm font-semibold text-text">{selectedHeader}</h2>
                {selectedPieces.length === 0 && selectedPauta.length === 0 ? (
                  <p className="text-xs text-muted">Sin publicaciones.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {selectedPieces.map((piece) => (
                      <li
                        key={piece.id}
                        className={`rounded-lg px-2.5 py-1.5 ${
                          piece.status === "publicado" ? "bg-emerald-500/10" : "bg-panel2/50"
                        }`}
                      >
                        <button type="button" onClick={() => setSelectedPiece(piece)} className="w-full text-left">
                          <p
                            className={`break-words text-xs font-medium ${
                              piece.status === "publicado" ? "text-emerald-300" : "text-text"
                            }`}
                          >
                            {pieceLabel(piece)}
                          </p>
                          {piece.client?.name && (
                            <p className="break-words text-[11px] text-muted">{piece.client.name}</p>
                          )}
                        </button>
                      </li>
                    ))}
                    {selectedPauta.map((post) => (
                      <li
                        key={post.id}
                        className={`rounded-lg px-2.5 py-1.5 ${
                          post.published ? "bg-emerald-500/10" : "bg-panel2/50"
                        }`}
                      >
                        <p
                          className={`break-words text-xs font-medium ${
                            post.published ? "text-emerald-300" : "text-text"
                          }`}
                        >
                          {post.name}
                        </p>
                        <p className="break-words text-[11px] text-muted">{post.clientName}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
              </div>

              {/* Clientes de solo pauta: posts semanales generados por mes, debajo del calendario. */}
              {!hidePauta && (selectedClientId === "all" || pautaClients.length > 0) && (
                <PautaSection
                  clients={pautaClients}
                  allClients={allClients}
                  month={month}
                  posts={pautaPosts}
                  setPosts={setPautaPosts}
                  rangeStart={toISO(days[0])}
                  rangeEnd={toISO(days[days.length - 1])}
                  onError={setErrorMsg}
                />
              )}

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

      <ContentPieceModal
        isOpen={!!selectedPiece}
        onClose={() => setSelectedPiece(null)}
        piece={selectedPiece}
        onSave={handleSavePiece}
        onDelete={handleDeletePiece}
      />
    </PageShell>
  );
}
