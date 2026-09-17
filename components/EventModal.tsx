"use client";

import { useState, useEffect, useMemo } from "react";
import { LuX } from "react-icons/lu";
import { pieceLabel, type CalendarEvent, type Client, type ContentPiece, type EventType, type Profile } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: string;
    selectedEvent: CalendarEvent | null;
    clients: Client[];
    existingContentPieces: ContentPiece[];
    onSave: (
        eventData: Partial<CalendarEvent>,
        selectedPieceCodes: string[],
        selectedMemberIds?: string[]
    ) => void;
    onDelete?: (eventId: string) => void;
}

const supabase = createClient()

const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function monthOfDate(d: string): number {
    const dt = d ? new Date(d + "T00:00:00") : new Date();
    return dt.getMonth() + 1;
}

const EVENT_TYPE_STYLES: Record<
    EventType,
    { label: string; bg: string; text: string; border: string }
> = {
    grabacion: {
        label: "🎥 Grabación",
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        border: "border-blue-500/40",
    },
    junta: {
        label: "🤝 Junta",
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/40",
    },
    cobertura: {
        label: "📸 Cobertura",
        bg: "bg-purple-500/10",
        text: "text-purple-400",
        border: "border-purple-500/40",
    },
    entrega: {
        label: "📦 Entrega",
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/40",
    },
    otro: {
        label: "📌 Otro",
        bg: "bg-rose-500/10",
        text: "text-rose-400",
        border: "border-rose-500/40",
    },
};

export default function EventModal({
    isOpen,
    onClose,
    selectedDate,
    selectedEvent,
    clients,
    existingContentPieces,
    onSave,
    onDelete,
}: EventModalProps) {
    const [title, setTitle] = useState("");
    const [eventType, setEventType] = useState<EventType>("grabacion");
    const [date, setDate] = useState(selectedDate);
    const [time, setTime] = useState("10:00");
    const [durationHours, setDurationHours] = useState<number>(1);
    const [location, setLocation] = useState("");
    const [clientId, setClientId] = useState<string>("");
    const [selectedPieceCodes, setSelectedPieceCodes] = useState<string[]>([]);
    const [notes, setNotes] = useState("");

    // Estado para los perfiles de equipo y miembros seleccionados del evento
    const [teamProfiles, setTeamProfiles] = useState<Profile[]>([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);

    // Determina si el tipo de evento actual permite cliente y piezas
    const isClientAllowed = eventType === "grabacion" || eventType === "junta";
    const currentStyle = EVENT_TYPE_STYLES[eventType] || EVENT_TYPE_STYLES.otro;

    const realCurrentMonth = monthOfDate("");

    // Mes del catálogo de piezas que se está navegando -- independiente de la fecha del
    // evento. Empieza en el mes del evento (sin poder bajar del mes real actual) y se
    // puede avanzar a meses futuros con ‹ ›, para poder grabar piezas "adelantadas" que
    // pertenecen al paquete de un mes que todavía no llega (ver isAdvancePiece en Entregas).
    const [catalogMonth, setCatalogMonth] = useState<number>(realCurrentMonth);
    const canGoToPrevCatalogMonth = catalogMonth > realCurrentMonth;
    const goToPrevCatalogMonth = () => {
        if (canGoToPrevCatalogMonth) setCatalogMonth((m) => m - 1);
    };
    const goToNextCatalogMonth = () => setCatalogMonth((m) => (m % 12) + 1);

    // Genera el catálogo de piezas para el cliente+mes que se está navegando: una
    // plantilla base de 4 video + 4 foto (para poder agendar piezas del paquete que
    // todavía no se han creado a mano), más cualquier pieza REAL de ese cliente+mes
    // que ya exista en la base y no esté cubierta por la plantilla -- piezas
    // individuales creadas en Entregas (con cualquier número, o más allá de las 4
    // base de un paquete grande) también deben poder agendarse aquí.
    const fullCatalogForClient = useMemo(() => {
        if (!clientId || !isClientAllowed) return [];
        const template: ContentPiece[] = [];
        for (let i = 1; i <= 4; i++) {
            template.push({
                id: `gen-v-${i}`,
                client_id: clientId,
                code: `${catalogMonth}.v.${i}`,
                type: "v",
                month: catalogMonth,
                status: "por_grabar",
            });
            template.push({
                id: `gen-f-${i}`,
                client_id: clientId,
                code: `${catalogMonth}.f.${i}`,
                type: "f",
                month: catalogMonth,
                status: "por_grabar",
            });
        }

        const templateCodes = new Set(template.map((p) => p.code));
        const realExtras = existingContentPieces.filter(
            (p) => p.client_id === clientId && p.month === catalogMonth && !templateCodes.has(p.code)
        );

        const combined = [...template, ...realExtras];
        combined.sort((a, b) => {
            const [, aType, aNum] = a.code.split(".");
            const [, bType, bNum] = b.code.split(".");
            if (aType !== bType) return aType === "v" ? -1 : 1;
            return (Number(aNum) || 0) - (Number(bNum) || 0);
        });
        return combined;
    }, [clientId, catalogMonth, isClientAllowed, existingContentPieces]);

    const selectablePieces = useMemo(() => {
        if (!clientId || !isClientAllowed) return [];
        return fullCatalogForClient.filter(
            (piece) =>
                !existingContentPieces.some(
                    (p) =>
                        p.client_id === clientId &&
                        p.code === piece.code &&
                        p.event_id &&
                        p.event_id !== selectedEvent?.id
                )
        );
    }, [clientId, fullCatalogForClient, existingContentPieces, selectedEvent, isClientAllowed]);

    const areAllSelected =
        selectablePieces.length > 0 &&
        selectablePieces.every((p) => selectedPieceCodes.includes(p.code));

    const handleToggleSelectAll = () => {
        if (areAllSelected) {
            setSelectedPieceCodes([]);
        } else {
            setSelectedPieceCodes(selectablePieces.map((p) => p.code));
        }
    };

    // Cargar perfiles de Supabase y los miembros asignados al evento
    useEffect(() => {
        if (!isOpen) return;

        const loadProfilesAndMembers = async () => {
            setLoadingProfiles(true);
            try {
                // Obtener perfiles de la base de datos
                const { data: profiles, error: profErr } = await supabase
                    .from("profiles")
                    .select("*");

                if (!profErr && profiles) {
                    setTeamProfiles(profiles as Profile[]);
                }

                // Cargar miembros existentes asociados al evento en public.event_members
                if (selectedEvent?.id) {
                    const { data: members, error: memErr } = await supabase
                        .from("event_members")
                        .select("user_id")
                        .eq("event_id", selectedEvent.id);

                    if (!memErr && members) {
                        setSelectedMemberIds(members.map((m: { user_id: string }) => m.user_id));
                    }
                } else {
                    setSelectedMemberIds([]);
                }
            } catch (err) {
                console.error("Error al cargar perfiles o miembros de evento:", err);
            } finally {
                setLoadingProfiles(false);
            }
        };

        loadProfilesAndMembers();
    }, [isOpen, selectedEvent]);

    useEffect(() => {
        if (selectedEvent) {
            setTitle(selectedEvent.title);
            const type = selectedEvent.event_type;
            setEventType(type);
            setDate(selectedEvent.event_date);
            setTime(selectedEvent.event_time || "10:00");
            setDurationHours(selectedEvent.duration_hours || 1);
            setLocation(selectedEvent.location || "");
            setNotes(selectedEvent.notes || "");

            if (type === "grabacion" || type === "junta") {
                setClientId(selectedEvent.client_id || "");
                setSelectedPieceCodes(selectedEvent.content_pieces?.map((p) => p.code) || []);
            } else {
                setClientId("");
                setSelectedPieceCodes([]);
            }
            setCatalogMonth(Math.max(monthOfDate(selectedEvent.event_date), monthOfDate("")));
        } else {
            setTitle("");
            setEventType("grabacion");
            setDate(selectedDate);
            setTime("10:00");
            setDurationHours(1);
            setLocation("");
            setClientId(clients[0]?.id || "");
            setSelectedPieceCodes([]);
            setNotes("");
            setSelectedMemberIds([]);
            setCatalogMonth(Math.max(monthOfDate(selectedDate), monthOfDate("")));
        }
    }, [selectedEvent, selectedDate, isOpen, clients]);

    if (!isOpen) return null;

    const handleEventTypeChange = (newType: EventType) => {
        setEventType(newType);
        // Si el evento no es Grabación ni Junta, desasociar cliente y piezas
        if (newType !== "grabacion" && newType !== "junta") {
            setClientId("");
            setSelectedPieceCodes([]);
        }
    };

    const togglePiece = (code: string) => {
        setSelectedPieceCodes((prev) =>
            prev.includes(code)
                ? prev.filter((c) => c !== code)
                : [...prev, code]
        );
    };

    const toggleMember = (memberId: string) => {
        setSelectedMemberIds((prev) =>
            prev.includes(memberId)
                ? prev.filter((id) => id !== memberId)
                : [...prev, memberId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const activeClientId = isClientAllowed ? clientId || null : null;
        const activePieceCodes = isClientAllowed ? selectedPieceCodes : [];

        // event_members (crear y editar) lo maneja saveEventToSupabase, junto con
        // el envío de invitaciones de Google Calendar a los miembros recién agregados.
        onSave(
            {
                id: selectedEvent?.id,
                title,
                event_type: eventType,
                event_date: date,
                event_time: time,
                duration_hours: Number(durationHours),
                location,
                client_id: activeClientId,
                notes,
            },
            activePieceCodes,
            selectedMemberIds
        );
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-card border ${currentStyle.border} bg-panel p-6 shadow-2xl text-text transition-colors`}>
                <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${currentStyle.bg} ${currentStyle.text} border ${currentStyle.border}`}>
                            {currentStyle.label}
                        </span>
                        <h2 className="text-lg font-semibold font-display">
                            {selectedEvent ? "Editar Evento" : "Agendar Evento"}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="rounded-md p-1 -m-1 text-muted hover:bg-panel2 hover:text-text"
                    >
                        <LuX className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-muted mb-1">
                            Título / Concepto *
                        </label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej: Grabación de contenido mensual"
                            className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
                        />
                    </div>

                    <div className={isClientAllowed ? "grid grid-cols-2 gap-3" : "w-full"}>
                        <div>
                            <label className="block text-xs font-medium text-muted mb-1">
                                Tipo de Evento
                            </label>
                            <select
                                value={eventType}
                                onChange={(e) => handleEventTypeChange(e.target.value as EventType)}
                                className={`w-full rounded-md border ${currentStyle.border} ${currentStyle.bg} ${currentStyle.text} px-3 py-2 text-sm outline-none focus:border-brand2 font-medium`}
                            >
                                <option value="grabacion" className="bg-panel text-text">🎥 Grabación</option>
                                <option value="junta" className="bg-panel text-text">🤝 Junta</option>
                                <option value="cobertura" className="bg-panel text-text">📸 Cobertura</option>
                                <option value="entrega" className="bg-panel text-text">📦 Entrega</option>
                                <option value="otro" className="bg-panel text-text">📌 Otro</option>
                            </select>
                        </div>

                        {/* Selector de cliente visible sólo para Grabación y Junta */}
                        {isClientAllowed && (
                            <div>
                                <label className="block text-xs font-medium text-muted mb-1">
                                    Cliente
                                </label>
                                <select
                                    value={clientId}
                                    onChange={(e) => {
                                        setClientId(e.target.value);
                                        setSelectedPieceCodes([]);
                                    }}
                                    className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
                                >
                                    <option value="">-- Sin Cliente --</option>
                                    {clients.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Catálogo de piezas para Grabación y Junta */}
                    {isClientAllowed && clientId && (
                        <div className="rounded-md border border-line bg-panel2/40 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                    <label className="text-xs font-medium text-muted">
                                        Piezas a grabar
                                    </label>
                                    <div className="flex items-center gap-1 border-ink-faint rounded-md border bg-panel2 px-1.5 py-0.5">
                                    <button
                                        type="button"
                                        onClick={goToPrevCatalogMonth}
                                        disabled={!canGoToPrevCatalogMonth}
                                        aria-label="Mes anterior"
                                        className="rounded px-1.5 py-0.5 text-xs text-muted hover:text-text hover:bg-panel disabled:opacity-30 disabled:hover:bg-transparent"
                                    >
                                        ‹
                                    </button>
                                    <span className="text-xs font-semibold text-text min-w-[5.5rem] text-center">
                                        {MONTH_NAMES[catalogMonth - 1]}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={goToNextCatalogMonth}
                                        aria-label="Mes siguiente"
                                        className="rounded px-1.5 py-0.5 text-xs text-muted hover:text-text hover:bg-panel"
                                    >
                                        ›
                                    </button>
                                    </div>
                                </div>
                                {selectablePieces.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleToggleSelectAll}
                                        className="text-[11px] font-medium text-ink-faint hover:text-muted focus:outline-none"
                                    >
                                        {areAllSelected ? "Desmarcar todas" : "Seleccionar todas"}
                                    </button>
                                )}
                            </div>

                            {catalogMonth !== monthOfDate(date) && (
                                <p className="text-[11px] text-amber-400/90 px-0.5">
                                    Grabando piezas de {MONTH_NAMES[catalogMonth - 1]} por adelantado.
                                </p>
                            )}

                            <div className="flex flex-wrap gap-2">
                                {fullCatalogForClient.map((piece) => {
                                    const realPiece = existingContentPieces.find(
                                        (p) => p.client_id === clientId && p.code === piece.code
                                    );

                                    const isRecordedElsewhere = existingContentPieces.some(
                                        (p) =>
                                            p.client_id === clientId &&
                                            p.code === piece.code &&
                                            p.event_id &&
                                            p.event_id !== selectedEvent?.id
                                    );

                                    const isSelected = selectedPieceCodes.includes(piece.code);

                                    return (
                                        <button
                                            key={piece.code}
                                            type="button"
                                            disabled={isRecordedElsewhere}
                                            onClick={() => togglePiece(piece.code)}
                                            className={[
                                                "max-w-[10rem] px-2.5 py-1 text-xs font-mono rounded-md border transition flex items-center gap-1",
                                                isRecordedElsewhere
                                                    ? "opacity-40 bg-panel2 border-line text-ink-faint cursor-not-allowed line-through"
                                                    : isSelected
                                                        ? "bg-brand2 text-on-primary border-brand2 font-semibold shadow"
                                                        : "bg-panel border-line text-text hover:border-brand2/60",
                                            ].join(" ")}
                                        >
                                            <span className="truncate">{pieceLabel(realPiece ?? piece)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Miembros esperados usando teamProfiles */}
                    <div>
                        <label className="block text-xs font-medium text-muted mb-1">
                            👥 Miembros Esperados en el Evento
                        </label>
                        {loadingProfiles ? (
                            <div className="text-xs text-muted p-2 rounded-md border border-line bg-panel2/30 animate-pulse">
                                Cargando perfiles del equipo...
                            </div>
                        ) : teamProfiles.length === 0 ? (
                            <div className="text-xs text-muted italic p-2 rounded-md border border-line bg-panel2/30">
                                No se encontraron miembros de equipo.
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2.5 rounded-md border border-line bg-panel2/40">
                                {teamProfiles.map((profile) => {
                                    const isSelected = selectedMemberIds.includes(profile.id);
                                    const displayName =
                                        profile.full_name ||
                                        profile.initials ||
                                        profile.email ||
                                        profile.id;

                                    return (
                                        <button
                                            key={profile.id}
                                            type="button"
                                            onClick={() => toggleMember(profile.id)}
                                            className={[
                                                "px-2.5 py-1 text-xs rounded-md border transition flex items-center gap-1.5",
                                                isSelected
                                                    ? "bg-brand2/20 text-brand2 border-brand2 font-medium"
                                                    : "bg-panel border-line text-muted hover:text-text hover:border-line/80",
                                            ].join(" ")}
                                        >
                                            <span>{isSelected ? "✓" : "+"}</span>
                                            <span>{displayName}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-muted mb-1">
                                Fecha
                            </label>
                            <input
                                type="date"
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-muted mb-1">
                                Hora
                            </label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-muted mb-1">
                                Duración (hrs)
                            </label>
                            <input
                                type="number"
                                step="0.5"
                                min="0.5"
                                value={durationHours}
                                onChange={(e) => setDurationHours(Number(e.target.value))}
                                className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted mb-1">
                            Ubicación
                        </label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Ej: Estudio B / Locación exterior"
                            className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted mb-1">
                            Notas Adicionales
                        </label>
                        <textarea
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notas de llamado, equipo necesario, etc."
                            className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2 resize-none"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-line">
                        {selectedEvent && onDelete ? (
                            <button
                                type="button"
                                onClick={() => {
                                    onDelete(selectedEvent.id);
                                    onClose();
                                }}
                                className="px-3 py-2 text-xs font-medium text-brand hover:bg-brand/10 rounded-md"
                            >
                                Eliminar
                            </button>
                        ) : (
                            <div />
                        )}

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-medium text-muted hover:text-text rounded-md"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-xs font-medium text-on-primary bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow"
                            >
                                Guardar Evento
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}