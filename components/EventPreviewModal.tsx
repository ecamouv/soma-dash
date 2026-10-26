"use client";

import { InfoRow, Modal } from "@/components/ui";
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

  const displayName = event.client?.name || event.title || "Evento";
  const pieces = event.content_pieces || [];
  const people = event.members?.length ?? 0;
  const date = new Date(`${event.event_date}T00:00:00`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Modal
      onClose={onClose}
      className="max-w-md rounded-2xl border-line"
      headerClassName="flex items-start justify-between mb-6"
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand2/20 text-muted font-bold text-xl border border-muted">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted">{event.event_type}</span>
            <h2 className="text-xl font-bold font-display text-text">{event.title}</h2>
          </div>
        </div>
      }
    >
      <div className="space-y-2.5 mb-6">
        <InfoRow label="Cliente">
          <span className="text-sm font-normal text-muted font-mono">{displayName}</span>
        </InfoRow>

        <InfoRow label="Personas que van">
          <span className="text-sm font-normal text-muted font-mono">
            {people > 0 ? `${people} ${people === 1 ? "persona" : "personas"}` : "--"}
          </span>
        </InfoRow>

        {pieces.length > 0 && (
          <InfoRow label="Piezas a grabar">
            <div className="flex flex-wrap gap-1.5 justify-end">
              {pieces.map((p) => (
                <span
                  key={p.code}
                  className="px-2 py-0.5 text-xs font-mono font-normal rounded-md bg-ink-faint text-ink border border-ink-faint"
                >
                  {pieceLabel(p)}
                </span>
              ))}
            </div>
          </InfoRow>
        )}

        <InfoRow label="Fecha y Hora">
          <span className="text-sm font-normal text-text font-mono">
            {date} {event.event_time ? `· ${event.event_time}` : ""}
          </span>
        </InfoRow>

        <InfoRow label="Duración Estimada">
          <span className="text-sm font-normal text-text font-mono">{event.duration_hours} h</span>
        </InfoRow>

        {event.location && (
          <InfoRow label="Ubicación">
            <span className="text-sm font-normal text-text">{event.location}</span>
          </InfoRow>
        )}

        {event.notes && (
          <div className="rounded-xl bg-panel2/60 px-4 py-3 border border-line/40 space-y-1">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted">Notas</span>
            <p className="text-sm font-normal text-text leading-relaxed">{event.notes}</p>
          </div>
        )}
      </div>

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
          className="px-6 py-2.5 text-xs font-semibold text-on-primary bg-brand hover:bg-brand2 rounded-xl transition shadow"
        >
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
