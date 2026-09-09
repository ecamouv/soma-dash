"use client";

import { useState, useEffect } from "react";
import { LuLink, LuCheck, LuExternalLink, LuBookOpen } from "react-icons/lu";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import type { Client } from "@/lib/types";
import { fetchClients } from "@/lib/events";
import { PACKAGES } from "@/lib/packages";

function formatPrice(price?: number | null): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(price);
}

function packageLabel(pkg?: string | null): string {
  if (!pkg) return "—";
  return PACKAGES[pkg as keyof typeof PACKAGES]?.label ?? pkg;
}

function ClientRow({ client, dimmed }: { client: Client; dimmed?: boolean }) {
  const [copied, setCopied] = useState(false);
  const publicUrl = client.public_token ? `${window.location.origin}/c/${client.public_token}` : null;

  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Error al copiar el enlace:", err);
    }
  };

  return (
    <tr className={`border-b border-line/60 last:border-0 ${dimmed ? "opacity-50" : ""}`}>
      <td className="px-4 py-3 font-medium text-text">{client.name}</td>
      <td className="px-4 py-3 text-muted">{formatPrice(client.price)}</td>
      <td className="px-4 py-3">
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-panel2 border border-line text-muted">
          {packageLabel(client.package)}
        </span>
      </td>
      <td className="px-4 py-3">
        {publicUrl ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              title="Copiar link"
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-muted hover:text-text border border-line rounded-md transition"
            >
              {copied ? (
                <LuCheck className="h-3 w-3 text-emerald-400" />
              ) : (
                <LuLink className="h-3 w-3" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir calendario público"
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-muted hover:text-text border border-line rounded-md transition"
            >
              <LuExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <span className="text-muted text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          title="Próximamente"
          className="flex w-fit items-center gap-1.5 text-[11px] text-muted/60 cursor-not-allowed"
        >
          <LuBookOpen className="h-3.5 w-3.5" />
          Próximamente
        </span>
      </td>
    </tr>
  );
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setClients(await fetchClients());
      } catch (err) {
        console.error("Error al cargar clientes:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeClients = clients.filter((c) => !c.paused);
  const pausedClients = clients.filter((c) => c.paused);

  return (
    <div className="flex h-screen text-text">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto bg-ink">
        <TopBar
          profile={{
            id: "admin",
            email: "admin@soma.mx",
            full_name: "Admin Soma",
            role: "admin",
            initials: "AS",
          }}
        />

        <div className="p-6 space-y-6">
          <div>
            <span className="text-xs text-muted">Operación › Clientes</span>
            <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-text to-muted bg-clip-text text-transparent">
              Clientes
            </h1>
          </div>

          {loading ? (
            <div className="text-xs text-muted p-4">Cargando clientes...</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line bg-panel2/40 text-left text-muted">
                      <th className="px-4 py-2.5 font-medium">Nombre</th>
                      <th className="px-4 py-2.5 font-medium">Precio</th>
                      <th className="px-4 py-2.5 font-medium">Paquete</th>
                      <th className="px-4 py-2.5 font-medium">Link a su calendario</th>
                      <th className="px-4 py-2.5 font-medium">Biblioteca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeClients.map((client) => (
                      <ClientRow key={client.id} client={client} />
                    ))}

                    {activeClients.length === 0 && pausedClients.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-muted italic">
                          No hay clientes todavía.
                        </td>
                      </tr>
                    )}

                    {pausedClients.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={5} className="px-4 py-2 bg-panel2/60 border-y border-line">
                            <span className="text-[11px] font-bold uppercase text-muted">
                              Pausados ({pausedClients.length})
                            </span>
                          </td>
                        </tr>
                        {pausedClients.map((client) => (
                          <ClientRow key={client.id} client={client} dimmed />
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
