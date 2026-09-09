"use client";

import { useState, useEffect } from "react";
import { LuEye, LuEyeClosed, LuTriangleAlert, LuCheck } from "react-icons/lu";
import { createClient } from "@/lib/supabase/client";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MIN_LENGTH = 6;

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const supabase = createClient();
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setPassword("");
      setConfirmPassword("");
      setShowPasswords(false);
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl text-text">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold font-display text-text">Cambiar contraseña</h2>
          <button
            onClick={handleClose}
            className="text-muted hover:text-text text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={handleContinue} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Nueva contraseña
              </label>
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
              <label className="block text-xs font-medium text-muted mb-1">
                Confirmar contraseña
              </label>
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
                onClick={handleClose}
                className="px-4 py-2 text-xs font-medium text-muted hover:text-text rounded-md"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow"
              >
                Continuar
              </button>
            </div>
          </form>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
              <p className="text-xs text-amber-200">
                Estás a punto de cambiar tu contraseña. La usarás la próxima vez que inicies
                sesión. ¿Confirmas este cambio?
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
                className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Sí, cambiar contraseña"}
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <LuCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
              <p className="text-xs text-emerald-200">Tu contraseña se actualizó correctamente.</p>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
