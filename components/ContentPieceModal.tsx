"use client";

import { useState, useEffect } from "react";
import { LuX } from "react-icons/lu";
import { pieceLabel, type ContentPiece } from "@/lib/types";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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
}

export default function ContentPieceModal({
  isOpen,
  onClose,
  piece,
  onSave,
}: ContentPieceModalProps) {
  const [dueDate, setDueDate] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [month, setMonth] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl text-text">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand2/20 text-xl border border-brand2/30">
              {isVideo ? "🎥" : "📸"}
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                {isVideo ? "Video" : "Foto"}
              </span>
              <h2 className="text-lg font-bold font-display text-text">
                {pieceLabel(piece)}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 -m-1 text-muted hover:bg-panel2 hover:text-text"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2.5 mb-6">
          <div className="flex items-center justify-between rounded-xl bg-panel2/60 px-4 py-3 border border-line/40">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Cliente
            </span>
            <span className="text-sm font-normal text-text font-mono">
              {piece.client?.name ?? "Sin cliente"}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-panel2/60 px-4 py-3 border border-line/40">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Código
            </span>
            <span className="text-sm font-normal text-muted font-mono">
              {piece.code}
            </span>
          </div>

          <div className="rounded-xl bg-panel2/60 px-4 py-3 border border-line/40 space-y-1.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted">
              Mes al que pertenece
            </span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-text outline-none focus:border-brand2"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-panel2/60 px-4 py-3 border border-line/40 space-y-1.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted">
              Nombre (opcional)
            </span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={`Sin nombre — se muestra "${piece.code}"`}
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-text outline-none focus:border-brand2 placeholder:text-muted/60"
            />
          </div>

          <div className="rounded-xl bg-panel2/60 px-4 py-3 border border-line/40 space-y-1.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted">
              Fecha de entrega
            </span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-text outline-none focus:border-brand2"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
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
      </div>
    </div>
  );
}
