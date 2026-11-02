"use client";

import { useState, useEffect } from "react";
import { InfoRow, Modal } from "@/components/ui";
import { pieceLabel, type ContentPiece } from "@/lib/types";
import { MONTH_NAMES } from "@/lib/utils";

interface ContentPieceModalProps {
  isOpen: boolean;
  onClose: () => void;
  piece: ContentPiece | null;
  onSave: (
    pieceId: string,
    dueDate: string | null,
    displayName: string | null,
    month: number
  ) => Promise<void> | void;
  onDelete?: (pieceId: string) => Promise<void> | void;
}

const fieldCls = "w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-text outline-none focus:border-brand2";

export default function ContentPieceModal({
  isOpen,
  onClose,
  piece,
  onSave,
  onDelete,
}: ContentPieceModalProps) {
  const [dueDate, setDueDate] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [month, setMonth] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
    setDueDate(piece?.due_date ?? "");
    setDisplayName(piece?.display_name ?? "");
    setMonth(piece?.month ?? new Date().getMonth() + 1);
  }, [piece]);

  if (!isOpen || !piece) return null;

  const isVideo = piece.type === "v";

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(piece.id, dueDate || null, displayName.trim() || null, month);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await onDelete?.(piece.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      headerClassName="flex items-start justify-between mb-5"
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand2/20 text-xl border border-brand2/30">
            {isVideo ? "🎥" : "📸"}
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              {isVideo ? "Video" : "Foto"}
            </span>
            <h2 className="text-lg font-bold font-display text-text">{pieceLabel(piece)}</h2>
          </div>
        </div>
      }
    >
      <div className="space-y-2.5 mb-6">
        <InfoRow label="Cliente">
          <span className="text-sm font-normal text-text font-mono">{piece.client?.name ?? "Sin cliente"}</span>
        </InfoRow>

        <InfoRow label="Código">
          <span className="text-sm font-normal text-muted font-mono">{piece.code}</span>
        </InfoRow>

        <InfoRow label="Mes al que pertenece" stacked>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={fieldCls}>
            {MONTH_NAMES.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </InfoRow>

        <InfoRow label="Nombre (opcional)" stacked>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={`Sin nombre — se muestra "${piece.code}"`}
            className={`${fieldCls} placeholder:text-muted/60`}
          />
        </InfoRow>

        <InfoRow label="Fecha de entrega" stacked>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldCls} />
        </InfoRow>
      </div>

      {confirmingDelete ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-text">¿Estás seguro que quieres borrarlo?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleDelete}
              className="px-4 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md disabled:opacity-50"
            >
              {saving ? "Borrando..." : "Borrar"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirmingDelete(false)}
              className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-md disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
      <div className="flex items-center justify-end gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mr-auto px-4 py-2 text-xs font-medium text-red-500 hover:text-red-400 rounded-md"
          >
            Borrar
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-medium text-muted hover:text-text rounded-md"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="px-4 py-2 text-xs font-medium text-on-primary bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
      )}
    </Modal>
  );
}
