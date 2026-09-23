"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LuLink, LuCheck, LuExternalLink, LuBookOpen, LuPlus, LuReceipt, LuSnowflake, LuPlay } from "react-icons/lu";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ProspectsBoard from "@/components/ProspectsBoard";
import ProspectModal from "@/components/ProspectModal";
import NewClientModal from "@/components/NewClientModal";
import PaymentsModal from "@/components/PaymentsModal";
import type { Client, Profile, Prospect, ProspectInput, ProspectStage } from "@/lib/types";
import { createClientWithPackage, fetchClients, setClientColor, setClientPaused } from "@/lib/events";
import {
  createProspect,
  deleteProspect,
  fetchProfiles,
  fetchProspects,
  updateProspect,
} from "@/lib/prospects";
import type { PackageValue } from "@/lib/packages";
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
  onTogglePause,
}: {
  client: Client;
  fallbackColor: string;
  dimmed?: boolean;
  onColorChange: (clientId: string, color: string) => void;
  onTogglePause: (client: Client) => Promise<void>;
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
        <button
          onClick={() => onTogglePause(client)}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-muted hover:text-text border border-line rounded-md transition"
        >
          {client.paused ? <LuPlay className="h-3 w-3" /> : <LuSnowflake className="h-3 w-3" />}
          {client.paused ? "Reanudar" : "Pausar"}
        </button>
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
  const [tab, setTab] = useState<"clientes" | "prospectos">("clientes");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isPaymentsOpen, setIsPaymentsOpen] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [prospectModal, setProspectModal] = useState<{ open: boolean; prospect: Prospect | null }>({
    open: false,
    prospect: null,
  });

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

  const loadClients = async () => {
    try {
      setClients(await fetchClients());
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    }
  };

  const loadProspects = async () => {
    try {
      setProspects(await fetchProspects());
    } catch (err) {
      console.error("Error al cargar prospectos:", err);
    }
  };

  useEffect(() => {
    if (loadingAuth) return;
    (async () => {
      await Promise.all([
        loadClients(),
        loadProspects(),
        fetchProfiles().then(setProfiles).catch(() => setProfiles([])),
      ]);
      setLoading(false);
    })();
  }, [loadingAuth]);

  const handleCreateClient: React.ComponentProps<typeof NewClientModal>["onCreate"] = async (input) => {
    setSuccessMsg(null);
    await createClientWithPackage(input.name, input.packageValue);
    setSuccessMsg(`Cliente "${input.name}" agregado con ${PACKAGES[input.packageValue].label}.`);
    await loadClients();
  };

  const handleTogglePause = async (client: Client) => {
    await setClientPaused(client.id, !client.paused);
    await loadClients();
  };

  const handleSaveProspect = async (input: ProspectInput, id?: string) => {
    if (id) await updateProspect(id, input);
    else await createProspect(input);
    await loadProspects();
  };

  const handleMoveStage = async (prospect: Prospect, stage: ProspectStage) => {
    setProspects((prev) => prev.map((p) => (p.id === prospect.id ? { ...p, stage } : p)));
    try {
      await updateProspect(prospect.id, { stage });
    } catch (err) {
      console.error("Error al mover prospecto:", err);
      await loadProspects();
    }
  };

  const handleConvertProspect = async (prospect: Prospect, packageValue: PackageValue) => {
    const created = await createClientWithPackage(prospect.name, packageValue);
    await updateProspect(prospect.id, { converted_client_id: created.id, stage: "ganado" });
    setSuccessMsg(`Prospecto "${prospect.name}" convertido en cliente.`);
    await Promise.all([loadClients(), loadProspects()]);
  };

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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-xs text-muted">Operación › Clientes</span>
              <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-text to-muted bg-clip-text text-transparent">
                Clientes
              </h1>
            </div>
            {tab === "clientes" && (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPaymentsOpen(true)}
                  className="flex items-center gap-1 rounded-md border border-line px-4 py-2 text-xs font-semibold text-text hover:bg-panel2"
                >
                  <LuReceipt className="h-3.5 w-3.5" /> Pagos
                </button>
                <button
                  onClick={() => setIsNewClientOpen(true)}
                  className="flex items-center gap-1 rounded-md bg-gradient-to-r from-brand to-brand2 px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110"
                >
                  <LuPlus className="h-3.5 w-3.5" /> Agregar cliente
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-1 border-b border-line">
            {(["clientes", "prospectos"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-4 py-2 text-xs font-semibold capitalize transition ${
                  tab === t ? "border-brand text-text" : "border-transparent text-muted hover:text-text"
                }`}
              >
                {t === "clientes" ? `Clientes (${activeClients.length})` : `Prospectos (${prospects.length})`}
              </button>
            ))}
          </div>

          {successMsg && <p className="text-xs text-emerald-600">{successMsg}</p>}

          {loading ? (
            <div className="text-xs text-muted p-4">Cargando clientes...</div>
          ) : tab === "prospectos" ? (
            <ProspectsBoard
              prospects={prospects}
              profiles={profiles}
              onOpen={(p) => setProspectModal({ open: true, prospect: p })}
              onNew={() => setProspectModal({ open: true, prospect: null })}
              onMoveStage={handleMoveStage}
            />
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
                      <th className="px-4 py-2.5 text-eyebrow">Acciones</th>
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
                        onTogglePause={handleTogglePause}
                      />
                    ))}

                    {activeClients.length === 0 && pausedClients.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-muted italic">
                          No hay clientes todavía.
                        </td>
                      </tr>
                    )}

                    {pausedClients.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={7} className="px-4 py-2 bg-panel2/60 border-y border-line">
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
                        onTogglePause={handleTogglePause}
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

      <NewClientModal
        isOpen={isNewClientOpen}
        onClose={() => setIsNewClientOpen(false)}
        onCreate={handleCreateClient}
      />
      <PaymentsModal
        isOpen={isPaymentsOpen}
        onClose={() => setIsPaymentsOpen(false)}
        clients={clients}
      />
      <ProspectModal
        isOpen={prospectModal.open}
        prospect={prospectModal.prospect}
        profiles={profiles}
        onClose={() => setProspectModal({ open: false, prospect: null })}
        onSave={handleSaveProspect}
        onDelete={async (id) => {
          await deleteProspect(id);
          await loadProspects();
        }}
        onConvert={handleConvertProspect}
      />
    </div>
  );
}
