"use client";

import { useState } from "react";
import { LuEye, LuEyeClosed, LuTriangleAlert, LuCheck } from "react-icons/lu";
import { createClient } from "@/lib/supabase/client";

const MIN_LENGTH = 6;

interface PasswordChangeFormProps {
  onCancel: () => void;
  cancelLabel?: string;
  onDone: () => void;
  doneLabel?: string;
}

/**
 * Lógica y pasos (form -> confirm -> success) de cambio de contraseña, compartidos
 * entre el modal de Configuración y la página pública de reseteo -- en ambos casos
 * el usuario ya tiene una sesión de Supabase válida (normal o de recovery), así que
 * el cambio en sí es el mismo supabase.auth.updateUser({ password }).
 */
export default function PasswordChangeForm({
  onCancel,
  cancelLabel = "Cancelar",
  onDone,
  doneLabel = "Cerrar",
}: PasswordChangeFormProps) {
  const supabase = createClient();
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setError(null);
    setStep("confirm");
  };

  const handleConfirmChange = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("form");
    } finally {
      setSaving(false);
    }
  };

  if (step === "confirm") {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
          <p className="text-xs text-amber-200">
            Estás a punto de cambiar tu contraseña. La usarás la próxima vez que inicies sesión.
            ¿Confirmas este cambio?
          </p>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => setStep("form")}
            className="px-4 py-2 text-xs font-medium text-muted hover:text-text rounded-md disabled:opacity-50"
          >
            Volver
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirmChange}
            className="px-4 py-2 text-xs font-medium text-on-primary bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Sí, cambiar contraseña"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <LuCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
          <p className="text-xs text-emerald-200">Tu contraseña se actualizó correctamente.</p>
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-2 text-xs font-medium text-on-primary bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow"
          >
            {doneLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleContinue} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted mb-1">Nueva contraseña</label>
        <input
          type={showPasswords ? "text" : "password"}
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">Confirmar contraseña</label>
        <input
          type={showPasswords ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-md border border-line bg-panel2 px-3 py-2 text-sm text-text outline-none focus:border-brand2"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowPasswords((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-muted hover:text-text"
      >
        {showPasswords ? <LuEyeClosed className="h-3 w-3" /> : <LuEye className="h-3 w-3" />}
        {showPasswords ? "Ocultar contraseñas" : "Mostrar contraseñas"}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-medium text-muted hover:text-text rounded-md"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-medium text-on-primary bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow"
        >
          Continuar
        </button>
      </div>
    </form>
  );
}
