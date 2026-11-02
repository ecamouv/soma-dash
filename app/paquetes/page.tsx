"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorBanner, PageHeader, PageShell, SessionLoading } from "@/components/ui";
import { fetchBillingData, savePackagePrice } from "@/lib/billingData";
import type { NewPackageInput } from "@/lib/packagesData";
import { formatMXN } from "@/lib/opsHome";
import AddPackageModal from "@/components/AddPackageModal";
import { packageSummary } from "@/lib/packages";
import { createPackage } from "@/lib/packagesData";
import { usePackages } from "@/lib/usePackages";
import { canAccess, canManageBilling } from "@/lib/roleAccess";
import { useEffectiveRole } from "@/lib/roleView";
import { useSession } from "@/lib/useSession";
import { errText } from "@/lib/utils";
import { LuCheck, LuPlus } from "react-icons/lu";

function PackageRow({
  label,
  detail,
  saved,
  onSave,
}: {
  label: string;
  detail: string;
  saved: number | undefined;
  onSave: (price: number | null) => Promise<void>;
}) {
  const [value, setValue] = useState(saved != null ? String(saved) : "");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = value.trim() !== (saved != null ? String(saved) : "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = value.trim() === "" ? null : Number(value);
    if (price != null && (!Number.isFinite(price) || price < 0)) return;
    setSaving(true);
    try {
      await onSave(price);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-4 border-b border-line/60 px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="text-[11px] text-muted">{detail}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">MXN / mes</span>
        <input
          type="number"
          min={0}
          step="any"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Sin precio"
          aria-label={`Precio mensual de ${label}`}
          className="w-32 rounded-md border border-line bg-panel2 px-3 py-1.5 text-right text-sm tabular-nums text-text outline-none focus:border-brand2"
        />
        <button
          type="submit"
          disabled={!dirty || saving}
          className="flex w-24 items-center justify-center gap-1 rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-text hover:bg-panel2 disabled:opacity-40"
        >
          {justSaved ? <LuCheck className="h-3.5 w-3.5 text-emerald-400" /> : saving ? "..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}

export default function PaquetesPage() {
  const router = useRouter();
  const currentUser = useSession();
  const role = useEffectiveRole(currentUser?.role);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [available, setAvailable] = useState(true);
  const { packages, list, available: packagesAvailable, reload: reloadPackages } = usePackages();
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role && !canAccess(role, "/paquetes")) router.replace("/");
  }, [role, router]);

  useEffect(() => {
    if (!currentUser) return;
    fetchBillingData()
      .then((d) => {
        setPrices(d.prices);
        setAvailable(d.available);
      })
      .catch((err) => setError(errText(err)))
      .finally(() => setLoading(false));
  }, [currentUser]);

  if (!currentUser) return <SessionLoading />;
  if (!canManageBilling(role)) return null;

  const handleCreate = async (input: NewPackageInput) => {
    const created = await createPackage(input, packages);
    if (input.price != null) setPrices((prev) => ({ ...prev, [created.value]: input.price as number }));
    await reloadPackages();
  };

  const handleSave = (pkg: string) => async (price: number | null) => {
    try {
      await savePackagePrice(pkg, price);
      setPrices((prev) => {
        const next = { ...prev };
        if (price == null) delete next[pkg];
        else next[pkg] = price;
        return next;
      });
    } catch (err) {
      setError(`No se pudo guardar el precio: ${errText(err)}`);
      throw err;
    }
  };

  return (
    <PageShell profile={currentUser}>
      <div className="max-w-3xl space-y-6 p-6">
        <PageHeader crumb="Operación › Paquetes" title="Paquetes">
          <button
            onClick={() => setAdding(true)}
            disabled={!packagesAvailable}
            title={packagesAvailable ? undefined : "Aplica la migración de paquetes en Supabase"}
            className="flex items-center gap-1 rounded-md bg-gradient-to-r from-brand to-brand2 px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110 disabled:opacity-50"
          >
            <LuPlus className="h-3.5 w-3.5" /> Agregar paquete
          </button>
        </PageHeader>
        <ErrorBanner message={error} onClose={() => setError(null)} />
        <p className="text-xs text-muted">
          Precio de cada paquete. En Clientes puedes personalizar un pago. Si cambias un precio, 
          los siguientes meses usarán el nuevo precio.
        </p>
        {!available && (
          <p className="text-xs text-crimson">Faltan las tablas de cobro. Aplica la migración de cobro en Supabase.</p>
        )}
        {!packagesAvailable && (
          <p className="text-xs text-crimson">Falta la tabla de paquetes. Aplica la migración de paquetes en Supabase.</p>
        )}
        {loading ? (
          <div className="p-4 text-xs text-muted">Cargando precios...</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
            {list.map((p) => (
              <PackageRow
                key={p.value}
                label={p.label}
                detail={`${packageSummary(p)}${prices[p.value] != null ? ` · actual ${formatMXN(prices[p.value])}` : ""}`}
                saved={prices[p.value]}
                onSave={handleSave(p.value)}
              />
            ))}
          </div>
        )}
      </div>
      {adding && <AddPackageModal onClose={() => setAdding(false)} onCreate={handleCreate} />}
    </PageShell>
  );
}
