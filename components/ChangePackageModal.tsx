"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui";
import { applyPackageChange, planPackageChange, type PackageChangePlan } from "@/lib/events";
import { packageSummary, type PackageDef } from "@/lib/packages";
import type { Client } from "@/lib/types";
import { MONTH_NAMES, errText } from "@/lib/utils";

export default function ChangePackageModal({
  client,
  packages,
  onClose,
  onChanged,
}: {
  client: Client;
  packages: PackageDef[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState(client.package ?? "");
  const [plan, setPlan] = useState<PackageChangePlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pkg = packages.find((p) => p.value === selected);
  const unchanged = selected === (client.package ?? "");

  // Vista previa de las piezas que se crearían con el paquete elegido.
  useEffect(() => {
    setPlan(null);
    if (!pkg || unchanged) return;
    let cancelled = false;
    planPackageChange(client.id, pkg)
      .then((p) => !cancelled && setPlan(p))
      .catch((err) => !cancelled && setError(errText(err)));
    return () => {
      cancelled = true;
    };
  }, [client.id, pkg, unchanged]);

  const handleConfirm = async () => {
    if (!pkg || !plan) return;
    setSaving(true);
    setError(null);
    try {
      await applyPackageChange(client.id, pkg, plan);
      onChanged();
    } catch (err) {
      setError(errText(err));
    } finally {
      setSaving(false);
    }
  };

  const reels = plan?.rows.filter((r) => r.type === "v").length ?? 0;
  const fotos = plan?.rows.filter((r) => r.type === "f").length ?? 0;

  return (
    <Modal title={`Paquete · ${client.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Paquete</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
          >
            {!client.package && <option value="">Sin paquete</option>}
            {packages.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {pkg && <p className="mt-1 text-[11px] text-muted">{packageSummary(pkg)}</p>}
        </div>

        {!unchanged && pkg && (
          <p className="rounded-md bg-panel2 px-3 py-2 text-xs text-muted">
            {plan === null
              ? "Calculando piezas..."
              : plan.rows.length === 0
                ? `No faltan piezas para ${MONTH_NAMES[plan.month - 1]}.`
                : `Se crearán ${plan.rows.length} ${plan.rows.length === 1 ? "pieza" : "piezas"} para ${MONTH_NAMES[plan.month - 1]} (${reels} reels, ${fotos} fotos). `}
            {" "}No se borra ni se cambia ninguna pieza existente, y este mes no se toca.
          </p>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-xs font-medium text-muted hover:text-text">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || unchanged || !pkg || plan === null}
            className="rounded-md bg-gradient-to-r from-brand to-brand2 px-4 py-2 text-xs font-medium text-on-primary shadow hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Cambiar paquete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
