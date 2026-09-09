"use client";

import { useState, useEffect } from "react";
import type { Client } from "@/lib/types";

interface NewPieceModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onCreate: (input: {
    clientId: string;
    type: "v" | "f";
    dueDate: string | null;
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
  const [dueDate, setDueDate] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setClientId(clients[0]?.id ?? "");
      setType("v");
      setDueDate("");
      setError(null);
    }
  }, [isOpen, clients]);

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
      await onCreate({ clientId, type, dueDate: dueDate || null });
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
            className="text-muted hover:text-text text-xl leading-none"
          >
            ✕
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
              {clients.length === 0 && <option value="">Sin clientes</option>}
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
                    ? "bg-brand2 text-white border-brand2"
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
                    ? "bg-brand2 text-white border-brand2"
                    : "bg-panel2 border-line text-muted hover:text-text"
                }`}
              >
                📸 Foto
              </button>
            </div>
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
              className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow disabled:opacity-50"
            >
              {saving ? "Creando..." : "Crear pieza"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
