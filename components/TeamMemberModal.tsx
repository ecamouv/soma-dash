"use client";

import { useEffect, useState } from "react";
import { LuX } from "react-icons/lu";
import { ROLE_LABEL, type UserRole } from "@/lib/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: { fullName: string; email: string; role: UserRole }) => Promise<void>;
}

const inputCls =
  "w-full rounded-md border border-line bg-panel2 px-3 py-2 text-xs text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand";

export default function TeamMemberModal({ isOpen, onClose, onCreate }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("editor");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFullName("");
      setEmail("");
      setRole("editor");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setError("Escribe el nombre completo y el correo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({ fullName: fullName.trim(), email: email.trim(), role });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl text-text">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold font-display">Agregar integrante</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="-m-1 rounded-md p-1 text-muted hover:bg-panel2 hover:text-text"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-muted">Nombre completo</span>
            <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-muted">Correo</span>
            <input
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-muted">Puesto</span>
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-muted">
            Se le enviará una invitación a su correo para definir su contraseña y entrar al dashboard.
          </p>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-4 py-2 text-xs font-semibold text-muted hover:text-text"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-gradient-to-r from-brand to-brand2 px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110 disabled:opacity-50"
            >
              {saving ? "Agregando..." : "Agregar e invitar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
