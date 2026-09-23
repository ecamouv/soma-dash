"use client";

import { useEffect, useState } from "react";
import { LuX, LuTrash2 } from "react-icons/lu";
import type { WebAccess, WebAccessInput } from "@/lib/accesses";

interface Props {
  isOpen: boolean;
  access: WebAccess | null; // null = crear
  sections: string[];
  defaultSection?: string;
  onClose: () => void;
  onSave: (input: WebAccessInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const inputCls =
  "w-full rounded-md border border-line bg-panel2 px-3 py-2 text-xs text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand";

const EMPTY: WebAccessInput = {
  name: "",
  url: "",
  section: "",
  email: "",
  password_note: "",
  notes: "",
  favorite: false,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

export default function AccessModal({ isOpen, access, sections, defaultSection, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState<WebAccessInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (access) {
      const { id, created_at, ...rest } = access;
      setForm({ ...EMPTY, ...rest });
    } else {
      setForm({ ...EMPTY, section: defaultSection ?? "" });
    }
  }, [isOpen, access, defaultSection]);

  if (!isOpen) return null;

  const set = <K extends keyof WebAccessInput>(k: K, v: WebAccessInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const text = (k: "name" | "url" | "section" | "email" | "password_note", placeholder?: string, list?: string) => (
    <input
      className={inputCls}
      list={list}
      placeholder={placeholder}
      value={form[k] ?? ""}
      onChange={(e) => set(k, e.target.value)}
    />
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Escribe el nombre de la plataforma.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          name: form.name.trim(),
          url: form.url?.trim() || null,
          section: form.section.trim() || "General",
          email: form.email?.trim() || null,
          password_note: form.password_note?.trim() || null,
          notes: form.notes?.trim() || null,
          favorite: form.favorite,
        },
        access?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-2xl text-text">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold font-display">{access ? "Editar acceso" : "Nuevo acceso"}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="-m-1 rounded-md p-1 text-muted hover:bg-panel2 hover:text-text"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Plataforma *">{text("name", "Ej. Artlist")}</Field>
          <Field label="Link">{text("url", "artlist.io")}</Field>
          <Field label="Sección">
            {text("section", "Ej. Música, B-Rolls, Templates...", "access-sections")}
            <datalist id="access-sections">
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Correo de la cuenta">{text("email")}</Field>
          <Field label="Dónde consultar la contraseña">
            {text("password_note", "Ej. Notion, gestor de contraseñas")}
          </Field>
          <p className="text-[11px] text-muted">
            No escribas la contraseña aquí. Solo indica dónde encontrarla.
          </p>
          <Field label="Notas">
            <textarea
              rows={2}
              className={inputCls}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.favorite}
              onChange={(e) => set("favorite", e.target.checked)}
            />
            Marcar como favorita
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            {access ? (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(`¿Eliminar "${access.name}"?`)) return;
                  await onDelete(access.id);
                  onClose();
                }}
                className="flex items-center gap-1 rounded-md px-3 py-2 text-xs font-semibold text-red-500 hover:bg-panel2"
              >
                <LuTrash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
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
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
