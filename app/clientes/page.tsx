"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LuLink, LuCheck, LuExternalLink, LuBookOpen } from "react-icons/lu";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import type { Client, Profile } from "@/lib/types";
import { fetchClients, setClientColor } from "@/lib/events";
import { PACKAGES } from "@/lib/packages";
import { defaultClientColor } from "@/lib/clientColors";
import { createClient } from "@/lib/supabase/client";

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

function ClientRow({
  client,
  fallbackColor,
  dimmed,
  onColorChange,
}: {
  client: Client;
  fallbackColor: string;
  dimmed?: boolean;
  onColorChange: (clientId: string, color: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
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

  const handleColorChange = async (newColor: string) => {
    setSavingColor(true);
    try {
      await setClientColor(client.id, newColor);
      onColorChange(client.id, newColor);
    } catch (err) {
      console.error("Error al guardar el color del cliente:", err);
    } finally {
      setSavingColor(false);
    }
  };

  return (
    <tr className={`border-b border-line/60 last:border-0 transition hover:bg-panel2/40 ${dimmed ? "opacity-50" : ""}`}>
      <td className="px-4 py-3 font-medium text-text">{client.name}</td>
      <td className="px-4 py-3">
        <input
          type="color"
          value={client.color || fallbackColor}
          disabled={savingColor}
          onChange={(e) => handleColorChange(e.target.value)}
          title="Color del cliente en Entregas"
          className="h-6 w-9 cursor-pointer rounded border border-line bg-transparent p-0 disabled:opacity-50"
        />
      </td>
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
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Validar sesión y obtener Perfil real desde public.profiles
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setCurrentUser(
        (userProfile as Profile) || {
          id: user.id,
          email: user.email || "",
          full_name: user.email?.split("@")[0] || "Usuario",
          role: "prod",
          initials: (user.email || "U").substring(0, 2).toUpperCase(),
        }
      );
      setLoadingAuth(false);
    };

    checkUser();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  useEffect(() => {
    if (loadingAuth) return;
    (async () => {
      try {
        setClients(await fetchClients());
      } catch (err) {
        console.error("Error al cargar clientes:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadingAuth]);

  const activeClients = clients.filter((c) => !c.paused);
  const pausedClients = clients.filter((c) => c.paused);

  // Índice estable (orden de fetchClients, por nombre) para el color por defecto en
  // el picker -- el mismo orden que usa Entregas para su paleta automática.
  const fallbackColorFor = (clientId: string) => {
    const i = clients.findIndex((c) => c.id === clientId);
    return defaultClientColor(i === -1 ? 0 : i);
  };

  const handleColorChange = (clientId: string, color: string) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, color } : c)));
  };

  if (loadingAuth || !currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-ink text-muted font-mono text-sm">
        Cargando sesión...
      </div>
    );
  }

  return (
    <div className="flex h-screen text-text">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto bg-ink">
        <TopBar profile={currentUser} onLogout={handleLogout} />


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
                      <th className="px-4 py-2.5 text-eyebrow">Nombre</th>
                      <th className="px-4 py-2.5 text-eyebrow">Color</th>
                      <th className="px-4 py-2.5 text-eyebrow">Precio</th>
                      <th className="px-4 py-2.5 text-eyebrow">Paquete</th>
                      <th className="px-4 py-2.5 text-eyebrow">Link a su calendario</th>
                      <th className="px-4 py-2.5 text-eyebrow">Biblioteca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeClients.map((client) => (
                      <ClientRow
                        key={client.id}
                        client={client}
                        fallbackColor={fallbackColorFor(client.id)}
                        onColorChange={handleColorChange}
                      />
                    ))}

                    {activeClients.length === 0 && pausedClients.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-muted italic">
                          No hay clientes todavía.
                        </td>
                      </tr>
                    )}

                    {pausedClients.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={6} className="px-4 py-2 bg-panel2/60 border-y border-line">
                            <span className="text-[11px] font-bold uppercase text-muted">
                              Pausados ({pausedClients.length})
                            </span>
                          </td>
                        </tr>
                        {pausedClients.map((client) => (
                          <ClientRow
                            key={client.id}
                            client={client}
                            fallbackColor={fallbackColorFor(client.id)}
                            onColorChange={handleColorChange}
                            dimmed
                          />
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
