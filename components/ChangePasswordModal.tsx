"use client";

import { LuX } from "react-icons/lu";
import PasswordChangeForm from "@/components/PasswordChangeForm";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl text-text">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold font-display text-text">Cambiar contraseña</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 -m-1 text-muted hover:bg-panel2 hover:text-text"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>

        {/* key=isOpen fuerza un remount cada vez que se abre, para que el formulario
            siempre inicie limpio (mismo efecto que el reset-on-open que tenía antes). */}
        <PasswordChangeForm
          key={String(isOpen)}
          onCancel={onClose}
          onDone={onClose}
        />
      </div>
    </div>
  );
}
