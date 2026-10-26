"use client";

import { errText } from "@/lib/utils";
import { Modal } from "@/components/ui";
import { useState, useEffect } from "react";
import { PACKAGE_LIST, type PackageValue } from "@/lib/packages";

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; packageValue: PackageValue }) => Promise<void> | void;
}

export default function NewClientModal({ isOpen, onClose, onCreate }: NewClientModalProps) {
  const [name, setName] = useState("");
  const [packageValue, setPackageValue] = useState<PackageValue>("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setPackageValue("1");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Escribe el nombre del cliente.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), packageValue });
      onClose();
    } catch (err) {
      setError(errText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Agregar cliente" onClose={onClose}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Nombre del cliente
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Metia MX"
              className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Paquete</label>
            <div className="grid grid-cols-2 gap-2">
              {PACKAGE_LIST.map((pkg) => (
                <button
                  key={pkg.value}
                  type="button"
                  onClick={() => setPackageValue(pkg.value)}
                  className={`rounded-md border px-3 py-3 text-xs font-semibold transition ${
                    packageValue === pkg.value
                      ? "bg-brand2 text-on-primary border-brand2"
                      : "bg-panel2 border-line text-muted hover:text-text"
                  }`}
                >
                  {pkg.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-muted hover:text-text rounded-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-on-primary bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow disabled:opacity-50"
            >
              {saving ? "Agregando..." : "Agregar cliente"}
            </button>
          </div>
        </form>
    </Modal>
  );
}
