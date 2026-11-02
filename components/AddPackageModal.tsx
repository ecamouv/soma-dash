"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";
import type { NewPackageInput } from "@/lib/packagesData";
import { errText } from "@/lib/utils";

const INPUT =
  "w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2";

function CountField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <input type="number" min={0} step={1} value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" className={INPUT} />
    </div>
  );
}

export default function AddPackageModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: NewPackageInput) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [reels, setReels] = useState("");
  const [fotos, setFotos] = useState("");
  const [carruseles, setCarruseles] = useState("");
  const [pauta, setPauta] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError("Escribe el nombre del paquete.");
      return;
    }
    const counts = [reels, fotos, carruseles, pauta].map((v) => (v.trim() === "" ? 0 : Number(v)));
    if (counts.some((n) => !Number.isInteger(n) || n < 0)) {
      setError("Reels, fotos, carruseles y pauta deben ser números enteros de 0 o más.");
      return;
    }
    const priceValue = price.trim() === "" ? null : Number(price);
    if (priceValue != null && (!Number.isFinite(priceValue) || priceValue < 0)) {
      setError("El precio debe ser un número de 0 o más.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        label: label.trim(),
        reels: counts[0],
        fotos: counts[1],
        carruseles: counts[2],
        pautaPerWeek: counts[3],
        price: priceValue,
      });
      onClose();
    } catch (err) {
      setError(errText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Agregar paquete" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nombre</label>
          <input type="text" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: Paquete Premium" className={INPUT} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CountField label="Reels al mes" value={reels} onChange={setReels} />
          <CountField label="Fotos al mes" value={fotos} onChange={setFotos} />
          <CountField label="Carruseles al mes" value={carruseles} onChange={setCarruseles} />
          <CountField label="Posts de pauta por semana" value={pauta} onChange={setPauta} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Precio mensual (MXN, opcional)</label>
          <input type="number" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Sin precio" className={INPUT} />
        </div>

        <p className="text-[11px] text-muted">
          Los reels y las fotos generan piezas cada mes. Los carruseles solo se cuentan como referencia. Si no pones nada en un campo se guarda 0.
        </p>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-xs font-medium text-muted hover:text-text">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-gradient-to-r from-brand to-brand2 px-4 py-2 text-xs font-medium text-on-primary shadow hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Agregar paquete"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
