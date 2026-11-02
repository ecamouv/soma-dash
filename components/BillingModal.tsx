"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";
import { feeFor, periodOf, type Billing, type PackagePrices } from "@/lib/billing";
import { saveBilling } from "@/lib/billingData";
import { formatMXN } from "@/lib/opsHome";
import type { PackageMap } from "@/lib/packages";
import type { Client } from "@/lib/types";
import { errText } from "@/lib/utils";

const INPUT =
  "w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2";

export default function BillingModal({
  client,
  billing,
  prices,
  packages,
  todayISO,
  onClose,
  onSaved,
}: {
  client: Client;
  billing?: Billing;
  prices: PackagePrices;
  packages: PackageMap;
  todayISO: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [payDay, setPayDay] = useState(String(billing?.pay_day ?? ""));
  const [customPrice, setCustomPrice] = useState(billing?.custom_price != null ? String(billing.custom_price) : "");
  const [startPeriod, setStartPeriod] = useState(billing?.start_period ?? periodOf(todayISO));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pkg = client.package ? packages[client.package] : undefined;
  const packageFee = feeFor(null, client.package, prices);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const day = Number(payDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      setError("El día de pago debe ser un número del 1 al 31.");
      return;
    }
    const custom = customPrice.trim() === "" ? null : Number(customPrice);
    if (custom != null && (!Number.isFinite(custom) || custom < 0)) {
      setError("El precio personalizado debe ser un número positivo.");
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startPeriod)) {
      setError("Elige el mes desde el que se cobra.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveBilling({ clientId: client.id, payDay: day, customPrice: custom, startPeriod });
      onSaved();
    } catch (err) {
      setError(errText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Configurar pago · ${client.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Día de pago de cada mes</label>
          <input
            type="number"
            min={1}
            max={31}
            value={payDay}
            onChange={(e) => setPayDay(e.target.value)}
            placeholder="15"
            className={INPUT}
            autoFocus
          />
          <p className="mt-1 text-[11px] text-muted">En meses más cortos se cobra el último día (31 en febrero queda 28 o 29).</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Precio mensual personalizado (opcional)</label>
          <input
            type="number"
            min={0}
            step="any"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            placeholder={packageFee != null ? String(packageFee) : "Sin precio de paquete"}
            className={INPUT}
          />
          <p className="mt-1 text-[11px] text-muted">
            {pkg?.label ?? "Sin paquete"}:{" "}
            {packageFee != null ? `${formatMXN(packageFee)} al mes.` : "aún no tiene precio en la página Paquetes."} Si lo dejas vacío se
            usa el del paquete.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Cobrar desde</label>
          <input type="month" value={startPeriod} onChange={(e) => setStartPeriod(e.target.value)} className={INPUT} />
          <p className="mt-1 text-[11px] text-muted">
            Los meses anteriores no cuentan como adeudo. Elige un mes pasado para que aparezca como pendiente.
          </p>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-gradient-to-r from-brand to-brand2 px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </form>
    </Modal>
  );
}
