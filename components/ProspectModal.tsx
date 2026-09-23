"use client";

import { useState, useEffect } from "react";
import { LuX, LuTrash2 } from "react-icons/lu";
import {
  PROSPECT_STAGES,
  PROSPECT_STAGE_LABEL,
  type Profile,
  type Prospect,
  type ProspectActivity,
  type ProspectInput,
  type ProspectStage,
} from "@/lib/types";
import { PACKAGE_LIST, type PackageValue } from "@/lib/packages";
import { addProspectActivity, fetchProspectActivity } from "@/lib/prospects";

interface ProspectModalProps {
  isOpen: boolean;
  prospect: Prospect | null; // null = crear
  profiles: Profile[];
  onClose: () => void;
  onSave: (input: ProspectInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onConvert: (prospect: Prospect, packageValue: PackageValue) => Promise<void>;
}

const EMPTY: ProspectInput = {
  name: "",
  contact_name: "",
  contact_role: "",
  email: "",
  phone: "",
  market: "",
  city: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  website: "",
  source: "",
  stage: "nuevo",
  estimated_value: null,
  next_step: "",
  next_step_date: null,
  notes: "",
  owner_id: null,
};

const inputCls =
  "w-full rounded-md border border-line bg-panel2 px-3 py-2 text-xs text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

export default function ProspectModal({
  isOpen,
  prospect,
  profiles,
  onClose,
  onSave,
  onDelete,
  onConvert,
}: ProspectModalProps) {
  const [form, setForm] = useState<ProspectInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ProspectActivity[]>([]);
  const [note, setNote] = useState("");
  const [convertPkg, setConvertPkg] = useState<PackageValue>("1");

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setNote("");
    setConvertPkg("1");
    if (prospect) {
      const { id, created_at, updated_at, converted_client_id, ...rest } = prospect;
      setForm({ ...EMPTY, ...rest });
      fetchProspectActivity(prospect.id).then(setActivity).catch(() => setActivity([]));
    } else {
      setForm(EMPTY);
      setActivity([]);
    }
  }, [isOpen, prospect]);

  if (!isOpen) return null;

  const set = <K extends keyof ProspectInput>(key: K, value: ProspectInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const text = (key: keyof ProspectInput) => (
    <input
      className={inputCls}
      value={(form[key] as string | null) ?? ""}
      onChange={(e) => set(key, e.target.value as never)}
    />
  );

  const clean = (): ProspectInput => {
    const out: Record<string, unknown> = { ...form };
    for (const k of Object.keys(out)) {
      if (typeof out[k] === "string" && (out[k] as string).trim() === "") out[k] = null;
    }
    out.name = form.name.trim();
    out.stage = form.stage;
    return out as unknown as ProspectInput;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Escribe el nombre del prospecto.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(clean(), prospect?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!prospect || !note.trim()) return;
    try {
      await addProspectActivity(prospect.id, note.trim());
      setNote("");
      setActivity(await fetchProspectActivity(prospect.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleConvert = async () => {
    if (!prospect) return;
    setSaving(true);
    setError(null);
    try {
      await onConvert(prospect, convertPkg);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-2xl text-text">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold font-display">
            {prospect ? "Editar prospecto" : "Agregar prospecto"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="-m-1 rounded-md p-1 text-muted hover:bg-panel2 hover:text-text"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Negocio / marca *">{text("name")}</Field>
            <Field label="Etapa">
              <select
                className={inputCls}
                value={form.stage}
                onChange={(e) => set("stage", e.target.value as ProspectStage)}
              >
                {PROSPECT_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {PROSPECT_STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contacto">{text("contact_name")}</Field>
            <Field label="Puesto">{text("contact_role")}</Field>
            <Field label="Correo">{text("email")}</Field>
            <Field label="Teléfono / WhatsApp">{text("phone")}</Field>
            <Field label="Mercado / giro">{text("market")}</Field>
            <Field label="Ciudad">{text("city")}</Field>
            <Field label="Instagram">{text("instagram")}</Field>
            <Field label="Facebook">{text("facebook")}</Field>
            <Field label="TikTok">{text("tiktok")}</Field>
            <Field label="Sitio web">{text("website")}</Field>
            <Field label="Cómo llegó (fuente)">{text("source")}</Field>
            <Field label="Valor estimado (MXN)">
              <input
                type="number"
                min="0"
                className={inputCls}
                value={form.estimated_value ?? ""}
                onChange={(e) =>
                  set("estimated_value", e.target.value === "" ? null : Number(e.target.value))
                }
              />
            </Field>
            <Field label="Responsable">
              <select
                className={inputCls}
                value={form.owner_id ?? ""}
                onChange={(e) => set("owner_id", e.target.value || null)}
              >
                <option value="">Sin asignar</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fecha del siguiente paso">
              <input
                type="date"
                className={inputCls}
                value={form.next_step_date ?? ""}
                onChange={(e) => set("next_step_date", e.target.value || null)}
              />
            </Field>
          </div>
          <Field label="Siguiente paso">{text("next_step")}</Field>
          <Field label="Notas">
            <textarea
              rows={3}
              className={inputCls}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            {prospect ? (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(`¿Eliminar a "${prospect.name}"?`)) return;
                  await onDelete(prospect.id);
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

        {prospect && prospect.stage === "ganado" && !prospect.converted_client_id && (
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel2/50 p-3">
            <span className="text-xs font-semibold">Convertir en cliente</span>
            <select
              className={`${inputCls} w-auto`}
              value={convertPkg}
              onChange={(e) => setConvertPkg(e.target.value as PackageValue)}
            >
              {PACKAGE_LIST.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleConvert}
              disabled={saving}
              className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              Convertir a cliente
            </button>
          </div>
        )}
        {prospect?.converted_client_id && (
          <p className="mt-5 text-xs text-emerald-600">Este prospecto ya fue convertido en cliente.</p>
        )}

        {prospect && (
          <div className="mt-6 space-y-3 border-t border-line pt-4">
            <h3 className="text-sm font-bold">Bitácora</h3>
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Llamada, junta, mensaje enviado..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNote();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddNote}
                className="rounded-md border border-line px-3 py-2 text-xs font-semibold hover:bg-panel2"
              >
                Agregar
              </button>
            </div>
            <ul className="space-y-2">
              {activity.length === 0 && (
                <li className="text-xs italic text-muted">Sin actividad todavía.</li>
              )}
              {activity.map((a) => (
                <li key={a.id} className="rounded-lg border border-line/60 bg-panel2/40 p-2.5 text-xs">
                  <p>{a.note}</p>
                  <p className="mt-1 text-[10px] text-muted">
                    {a.author?.full_name ? `${a.author.full_name} · ` : ""}
                    {new Date(a.created_at).toLocaleString("es-MX", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
