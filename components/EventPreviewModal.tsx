"use client";

import { pieceLabel, type CalendarEvent } from "@/lib/types";

interface EventPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  onEdit: () => void;
}

export default function EventPreviewModal({
  isOpen,
  onClose,
  event,
  onEdit,
}: EventPreviewModalProps) {
  if (!isOpen || !event) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    const months = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];
    const monthName = months[parseInt(month, 10) - 1] || "";
    return `${parseInt(day, 10)} de ${monthName} de ${year}`;
  };

  const displayName = event.client?.name || event.title || "Evento";
  const initialLetter = displayName.charAt(0).toUpperCase();
  const pieces = event.content_pieces || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl text-text">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand2/20 text-brand2 font-bold text-xl border border-brand2/30">
              {initialLetter}
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                {event.event_type}
              </span>
              <h2 className="text-xl font-bold font-display text-text">
                {event.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Info Cards */}
        <div className="space-y-2.5 mb-6">
        <div className="flex items-center justify-between rounded-xl bg-panel2/60 px-4 py-3 border border-line/40">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Cliente
            </span>
            <span className="text-sm font-normal text-muted font-mono">
              {displayName}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-panel2/60 px-4 py-3 border border-line/40">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Personas que van
            </span>
            <span className="text-sm font-normal text-muted font-mono">
              --
            </span>
          </div>

          {pieces.length > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-panel2/60 px-4 py-3 border border-line/40">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Piezas a grabar
              </span>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {pieces.map((p) => (
                  <span
                    key={p.code}
                    className="px-2 py-0.5 text-xs font-mono font-normal rounded-md bg-brand2/15 text-brand2 border border-brand2/30"
                  >
                    {pieceLabel(p)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-panel2/60 px-4 py-3 border border-line/40">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Fecha y Hora
            </span>
            <span className="text-sm font-normal text-text font-mono">
              {formatDate(event.event_date)} {event.event_time ? `· ${event.event_time}` : ""}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-panel2/60 px-4 py-3 border border-line/40">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Duración Estimada
            </span>
            <span className="text-sm font-normal text-text font-mono">
              {event.duration_hours} h
            </span>
          </div>

          {event.location && (
            <div className="flex items-center justify-between rounded-xl bg-panel2/60 px-4 py-3 border border-line/40">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Ubicación
              </span>
              <span className="text-sm font-normal text-text">
                {event.location}
              </span>
            </div>
          )}

          {event.notes && (
            <div className="rounded-xl bg-panel2/60 px-4 py-3 border border-line/40 space-y-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted">
                Notas
              </span>
              <p className="text-sm font-normal text-text leading-relaxed">
                {event.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-text border border-line hover:bg-panel2 rounded-xl transition"
          >
            ✏️ Editar
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-xl transition shadow"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}