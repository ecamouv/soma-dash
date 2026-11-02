"use client";

import { useState, useEffect, useRef } from "react";
import { LuLink, LuCheck, LuExternalLink, LuBookOpen, LuPlus, LuSnowflake, LuPlay, LuReceipt, LuPencil } from "react-icons/lu";
import NewClientModal from "@/components/NewClientModal";
import BillingModal from "@/components/BillingModal";
import { PageHeader, PageShell, SessionLoading } from "@/components/ui";
import type { Client } from "@/lib/types";
import { createClientWithPackage, fetchClients, setClientColor, setClientPaused } from "@/lib/events";
import { packageSummary, type PackageMap } from "@/lib/packages";
import { usePackages } from "@/lib/usePackages";
import ChangePackageModal from "@/components/ChangePackageModal";
import { buildClientColorMap } from "@/lib/clientColors";
import { useSession } from "@/lib/useSession";
import { useEffectiveRole } from "@/lib/roleView";
import { canManageBilling } from "@/lib/roleAccess";
import { feeFor, type Billing, type PackagePrices } from "@/lib/billing";
import { EMPTY_BILLING, fetchBillingData, type BillingData } from "@/lib/billingData";
import { iso } from "@/lib/utils";

function formatPrice(price?: number | null): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(price);
}

function packageLabel(packages: PackageMap, pkg?: string | null): string {
  if (!pkg) return "—";
  return packages[pkg]?.label ?? pkg;
}

function ClientRow({
  client,
  fallbackColor,
  dimmed,
  showBilling,
  billing,
  prices,
  packages,
  onChangePackage,
  onConfigureBilling,
  onColorChange,
  onTogglePause,
}: {
  client: Client;
  fallbackColor: string;
  dimmed?: boolean;
  showBilling: boolean;
  billing?: Billing;
  prices: PackagePrices;
  packages: PackageMap;
  /** Solo roles que manejan cobro pueden cambiar el paquete. */
  onChangePackage?: (client: Client) => void;
  onConfigureBilling: (client: Client) => void;
  onColorChange: (clientId: string, color: string) => void;
  onTogglePause: (client: Client) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  // Color mientras se arrastra en el selector; se guarda una sola vez al cerrarlo.
  const [draftColor, setDraftColor] = useState<string | null>(null);
  const colorRef = useRef<HTMLInputElement>(null);
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

  // El "change" nativo llega una vez al cerrar el selector; el onChange de React se
  // dispara en cada movimiento y mandaría decenas de updates que pueden llegar desordenados.
  useEffect(() => {
    const el = colorRef.current;
    if (!el) return;
    const commit = async () => {
      setSavingColor(true);
      try {
        await setClientColor(client.id, el.value);
        onColorChange(client.id, el.value);
      } catch (err) {
        console.error("Error al guardar el color del cliente:", err);
      } finally {
        setDraftColor(null);
        setSavingColor(false);
      }
    };
    el.addEventListener("change", commit);
    return () => el.removeEventListener("change", commit);
  });

  return (
    <tr className={`border-b border-line/60 last:border-0 transition hover:bg-panel2/40 ${dimmed ? "opacity-50" : ""}`}>
      <td className="px-4 py-3 font-medium text-text">{client.name}</td>
      <td className="px-4 py-3">
        <input
          ref={colorRef}
          type="color"
          value={draftColor ?? (client.color || fallbackColor)}
          disabled={savingColor}
          onChange={(e) => setDraftColor(e.target.value)}
          title="Color del cliente en Entregas"
          className="h-6 w-9 cursor-pointer rounded border border-line bg-transparent p-0 disabled:opacity-50"
        />
      </td>
      <td className="px-4 py-3 text-muted">{formatPrice(client.price)}</td>
      <td className="px-4 py-3">
        {onChangePackage ? (
          <button
            onClick={() => onChangePackage(client)}
            title="Cambiar paquete"
            className="flex items-center gap-1.5 rounded-full border border-line bg-panel2 px-2 py-0.5 text-[11px] font-semibold text-muted transition hover:text-text"
          >
            {packageLabel(packages, client.package)}
            <LuPencil className="h-3 w-3" />
          </button>
        ) : (
          <span className="rounded-full border border-line bg-panel2 px-2 py-0.5 text-[11px] font-semibold text-muted" title={client.package && packages[client.package] ? packageSummary(packages[client.package]) : undefined}>
            {packageLabel(packages, client.package)}
          </span>
        )}
      </td>
      {showBilling && (
        <td className="px-4 py-3">
          <button
            onClick={() => onConfigureBilling(client)}
            title="Configurar pago mensual"
            className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-medium text-muted transition hover:text-text"
          >
            <LuReceipt className="h-3 w-3" />
            {billing ? (
              <span className="tabular-nums">
                Día {billing.pay_day} · {formatPrice(feeFor(billing, client.package, prices))}
              </span>
            ) : (
              "Configurar pago"
            )}
          </button>
        </td>
      )}
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
  const currentUser = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const { packages, list: packageOptions } = usePackages();
  const [packageClient, setPackageClient] = useState<Client | null>(null);
  const effectiveRole = useEffectiveRole(currentUser?.role);
  const showBilling = canManageBilling(effectiveRole);
  const [billingData, setBillingData] = useState<BillingData>(EMPTY_BILLING);
  const [billingClient, setBillingClient] = useState<Client | null>(null);
  const todayISO = iso(new Date());

  const loadBilling = async () => {
    try {
      setBillingData(await fetchBillingData());
    } catch (err) {
      console.error("Error al cargar el cobro:", err);
    }
  };

  const loadClients = async () => {
    try {
      setClients(await fetchClients());
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    loadClients().then(() => setLoading(false));
    if (canManageBilling(effectiveRole)) loadBilling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, effectiveRole]);

  const handleCreateClient: React.ComponentProps<typeof NewClientModal>["onCreate"] = async (input) => {
    setSuccessMsg(null);
    const pkg = packages[input.packageValue];
    if (!pkg) throw new Error("Ese paquete ya no existe.");
    await createClientWithPackage(input.name, pkg);
    setSuccessMsg(`Cliente "${input.name}" agregado con ${pkg.label}.`);
    await loadClients();
  };

  const handleTogglePause = async (client: Client) => {
    await setClientPaused(client.id, !client.paused);
    await loadClients();
  };

  const billingByClient = new Map(billingData.billings.map((b) => [b.client_id, b]));
  const activeClients = clients.filter((c) => !c.paused);
  const pausedClients = clients.filter((c) => c.paused);

  // Índice estable (orden de fetchClients, por nombre) para el color por defecto en
  // el picker -- el mismo orden que usa Entregas para su paleta automática.
  const clientColorMap = buildClientColorMap(clients);
  const fallbackColorFor = (clientId: string) => clientColorMap.get(clientId) ?? "#91919a";

  const handleColorChange = (clientId: string, color: string) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, color } : c)));
  };

  if (!currentUser) return <SessionLoading />;

  return (
    <PageShell profile={currentUser}>
        <div className="p-6 space-y-6">
          <PageHeader crumb="Operación › Clientes" title="Clientes">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsNewClientOpen(true)}
                  className="flex items-center gap-1 rounded-md bg-gradient-to-r from-brand to-brand2 px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110"
                >
                  <LuPlus className="h-3.5 w-3.5" /> Agregar cliente
                </button>
              </div>
          </PageHeader>

          {successMsg && <p className="text-xs text-emerald-600">{successMsg}</p>}

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
                      {showBilling && <th className="px-4 py-2.5 text-eyebrow">Pago mensual</th>}
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
                        showBilling={showBilling}
                        billing={billingByClient.get(client.id)}
                        prices={billingData.prices}
                        packages={packages}
                        onChangePackage={showBilling ? setPackageClient : undefined}
                        onConfigureBilling={setBillingClient}
                      />
                    ))}

                    {activeClients.length === 0 && pausedClients.length === 0 && (
                      <tr>
                        <td colSpan={showBilling ? 8 : 7} className="px-4 py-6 text-center text-muted italic">
                          No hay clientes todavía.
                        </td>
                      </tr>
                    )}

                    {pausedClients.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={showBilling ? 8 : 7} className="px-4 py-2 bg-panel2/60 border-y border-line">
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
                            showBilling={showBilling}
                            billing={billingByClient.get(client.id)}
                            prices={billingData.prices}
                            packages={packages}
                            onChangePackage={showBilling ? setPackageClient : undefined}
                            onConfigureBilling={setBillingClient}
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

      <NewClientModal
        isOpen={isNewClientOpen}
        onClose={() => setIsNewClientOpen(false)}
        packages={packageOptions}
        onCreate={handleCreateClient}
      />
      {packageClient && (
        <ChangePackageModal
          client={packageClient}
          packages={packageOptions}
          onClose={() => setPackageClient(null)}
          onChanged={() => {
            setPackageClient(null);
            loadClients();
          }}
        />
      )}
      {billingClient && (
        <BillingModal
          client={billingClient}
          billing={billingByClient.get(billingClient.id)}
          prices={billingData.prices}
          packages={packages}
          todayISO={todayISO}
          onClose={() => setBillingClient(null)}
          onSaved={() => {
            setBillingClient(null);
            loadBilling();
          }}
        />
      )}
    </PageShell>
  );
}
