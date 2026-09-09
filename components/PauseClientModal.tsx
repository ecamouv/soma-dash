"use client";

import { useState } from "react";
import { LuSnowflake, LuPlay, LuLink, LuCheck } from "react-icons/lu";
import type { Client } from "@/lib/types";

interface PauseClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onPause: (clientId: string) => Promise<void> | void;
  onResume: (clientId: string) => Promise<void> | void;
}

export default function PauseClientModal({
  isOpen,
  onClose,
  clients,
  onPause,
  onResume,
}: PauseClientModalProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopyLink = async (client: Client) => {
    if (!client.public_token) return;
    const url = `${window.location.origin}/c/${client.public_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(client.id);
      setTimeout(() => setCopiedId((cur) => (cur === client.id ? null : cur)), 1500);
    } catch (err) {
      console.error("Error al copiar el enlace:", err);
    }
  };

  const activeClients = clients.filter((c) => !c.paused);
  const pausedClients = clients.filter((c) => c.paused);

  const handlePause = async (clientId: string) => {
    setBusyId(clientId);
    setError(null);
    try {
      await onPause(clientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleResume = async (clientId: string) => {
    setBusyId(clientId);
    setError(null);
    try {
      await onResume(clientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl text-text">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
              <LuSnowflake className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold font-display text-text">Pausar cliente</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-text text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <p className="text-[11px] text-muted mb-4">
          Al pausar, su contenido y eventos dejan de aparecer en Calendario, Entregas
          y Publicaciones -- nada se borra, y reanudar lo regresa tal cual estaba.
        </p>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase text-muted">
              Activos ({activeClients.length})
            </h3>
            {activeClients.length === 0 ? (
              <p className="text-xs text-muted italic">No hay clientes activos.</p>
            ) : (
              <div className="space-y-1.5">
                {activeClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between rounded-lg border border-line bg-panel2 px-3 py-2"
                  >
                    <span className="text-xs font-medium text-text">{client.name}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleCopyLink(client)}
                        title="Copiar link público de calendario"
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-muted hover:text-text border border-line rounded-md"
                      >
                        {copiedId === client.id ? (
                          <LuCheck className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <LuLink className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        disabled={busyId === client.id}
                        onClick={() => handlePause(client.id)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:brightness-110 rounded-md shadow disabled:opacity-50"
                      >
                        <LuSnowflake className="h-3 w-3" />
                        {busyId === client.id ? "..." : "Pausar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase text-muted">
              Pausados ({pausedClients.length})
            </h3>
            {pausedClients.length === 0 ? (
              <p className="text-xs text-muted italic">No hay clientes pausados.</p>
            ) : (
              <div className="space-y-1.5">
                {pausedClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2"
                  >
                    <span className="text-xs font-medium text-text">{client.name}</span>
                    <button
                      disabled={busyId === client.id}
                      onClick={() => handleResume(client.id)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-300 border border-blue-500/40 hover:bg-blue-500/10 rounded-md disabled:opacity-50"
                    >
                      <LuPlay className="h-3 w-3" />
                      {busyId === client.id ? "..." : "Reanudar"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end pt-4 mt-2 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-muted hover:text-text rounded-md"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
