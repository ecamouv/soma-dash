"use client";

import { Modal } from "@/components/ui";
import PasswordChangeForm from "@/components/PasswordChangeForm";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  if (!isOpen) return null;

  return (
    <Modal title="Cambiar contraseña" onClose={onClose}>
        {/* key=isOpen fuerza un remount cada vez que se abre, para que el formulario
            siempre inicie limpio (mismo efecto que el reset-on-open que tenía antes). */}
        <PasswordChangeForm
          key={String(isOpen)}
          onCancel={onClose}
          onDone={onClose}
        />
    </Modal>
  );
}
