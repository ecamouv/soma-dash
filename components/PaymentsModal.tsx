"use client";

import { useState, useEffect } from "react";
import { LuTrash2 } from "react-icons/lu";
import type { Client, ClientPayment } from "@/lib/types";
import { fetchClientPayments, createClientPayment, deleteClientPayment } from "@/lib/payments";

interface PaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
}

export default function PaymentsModal({ isOpen, onClose, clients }: PaymentsModalProps) {
  const activeClients = clients.filter((c) => !c.paused);
  const [clientId, setClientId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [label, setLabel] = useState("");
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setClientId(activeClients[0]?.id ?? "");
      setDueDate("");
      setLabel("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadPayments = async (id: string) => {
    if (!id) {
      setPayments([]);
      return;
    }
    setLoading(true);
    try {
      setPayments(await fetchClientPayments(id));
    } catch (err) {
      console.error("Error al cargar pagos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && clientId) loadPayments(clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, clientId]);

  if (!isOpen) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !dueDate) {
      setError("Selecciona un cliente y una fecha.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createClientPayment({ clientId, dueDate, label: label || null });
      setDueDate("");
      setLabel("");
      await loadPayments(clientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (paymentId: string) => {
    try {
      await deleteClientPayment(paymentId);
      setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl text-text">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold font-display text-text">Fechas de pago</h2>
          <button onClick={onClose} className="text-muted hover:text-text text-xl leading-none">
            ✕
          </button>
        </div>

        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Cliente</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-emerald-500"
            >
              {activeClients.length === 0 && <option value="">Sin clientes</option>}
              {activeClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Fecha</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Etiqueta (opcional)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Anticipo, Liquidación..."
                className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving || !clientId}
            className="w-full px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 rounded-md shadow disabled:opacity-50"
          >
            {saving ? "Agregando..." : "+ Agregar pago"}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-line space-y-2 max-h-56 overflow-y-auto">
          <h3 className="text-[11px] font-bold uppercase text-muted">
            Pagos de {activeClients.find((c) => c.id === clientId)?.name ?? "..."}
          </h3>
          {loading ? (
            <p className="text-xs text-muted">Cargando...</p>
          ) : payments.length === 0 ? (
            <p className="text-xs text-muted italic">Sin fechas de pago registradas.</p>
          ) : (
            payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-line bg-panel2 px-3 py-2"
              >
                <div className="text-xs">
                  <span className="font-mono font-semibold text-text">{p.due_date}</span>
                  {p.label && <span className="text-muted"> · {p.label}</span>}
                </div>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-muted hover:text-red-400"
                  aria-label="Eliminar pago"
                >
                  <LuTrash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
