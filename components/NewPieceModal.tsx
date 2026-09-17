"use client";

import { useState, useEffect } from "react";
import { LuX } from "react-icons/lu";
import type { Client } from "@/lib/types";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface NewPieceModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onCreate: (input: {
    clientId: string;
    type: "v" | "f";
    dueDate: string | null;
    displayName: string | null;
    month: number;
  }) => Promise<void> | void;
}

export default function NewPieceModal({
  isOpen,
  onClose,
  clients,
  onCreate,
}: NewPieceModalProps) {
  const [clientId, setClientId] = useState<string>("");
  const [type, setType] = useState<"v" | "f">("v");
  const [displayName, setDisplayName] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setClientId("");
      setType("v");
      setDisplayName("");
      setDueDate("");
      setMonth(new Date().getMonth() + 1);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setError("Selecciona un cliente.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        clientId,
        type,
        dueDate: dueDate || null,
        displayName: displayName.trim() || null,
        month,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl text-text">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold font-display text-text">Nueva pieza</h2>
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
            <label className="block text-xs font-medium text-muted mb-1">Cliente</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
            >
              <option value="" disabled>
                {clients.length === 0 ? "Sin clientes" : "Selecciona un cliente"}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Tipo</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("v")}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition ${
                  type === "v"
                    ? "bg-brand2 text-on-primary border-brand2"
                    : "bg-panel2 border-line text-muted hover:text-text"
                }`}
              >
                🎥 Video
              </button>
              <button
                type="button"
                onClick={() => setType("f")}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition ${
                  type === "f"
                    ? "bg-brand2 text-on-primary border-brand2"
                    : "bg-panel2 border-line text-muted hover:text-text"
                }`}
              >
                📸 Foto
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Mes al que pertenece
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Nombre (opcional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Sin nombre — se mostrará el código generado"
              className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2 placeholder:text-muted/60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Fecha de entrega (opcional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-muted hover:text-text rounded-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !clientId}
              className="px-4 py-2 text-xs font-medium text-on-primary bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow disabled:opacity-50"
            >
              {saving ? "Creando..." : "Crear pieza"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
