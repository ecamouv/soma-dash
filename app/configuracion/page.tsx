"use client";

import { useState } from "react";
import { LuLock, LuKeyRound } from "react-icons/lu";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import { PageHeader, PageShell, SessionLoading } from "@/components/ui";
import { useSession } from "@/lib/useSession";

export default function ConfiguracionPage() {
  const currentUser = useSession();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  if (!currentUser) return <SessionLoading />;

  return (
    <PageShell profile={currentUser}>
      <div className="p-6 space-y-6 max-w-2xl">
        <PageHeader crumb="Configuración" title="Configuración" />

        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
          <div className="h-1 bg-gradient-to-r from-brand to-brand2" />
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand/20 to-brand2/20 text-brand2">
                <LuLock className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text">Seguridad</h2>
                <p className="text-[11px] text-muted">
                  Administra la contraseña de tu cuenta ({currentUser.email})
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsChangePasswordOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-on-primary bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow"
            >
              <LuKeyRound className="h-3.5 w-3.5" />
              Cambiar contraseña
            </button>
          </div>
        </div>
      </div>

      <ChangePasswordModal isOpen={isChangePasswordOpen} onClose={() => setIsChangePasswordOpen(false)} />
    </PageShell>
  );
}
