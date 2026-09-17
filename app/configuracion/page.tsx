"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LuLock, LuKeyRound } from "react-icons/lu";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import type { Profile } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

export default function ConfiguracionPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setCurrentUser(
        (userProfile as Profile) || {
          id: user.id,
          email: user.email || "",
          full_name: user.email?.split("@")[0] || "Usuario",
          role: "prod",
          initials: (user.email || "U").substring(0, 2).toUpperCase(),
        }
      );
      setLoadingAuth(false);
    };

    checkUser();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loadingAuth || !currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-ink text-muted font-mono text-sm">
        Cargando sesión...
      </div>
    );
  }

  return (
    <div className="flex h-screen text-text">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto bg-ink">
        <TopBar profile={currentUser} onLogout={handleLogout} />

        <div className="p-6 space-y-6 max-w-2xl">
          <div>
            <span className="text-xs text-muted">Configuración</span>
            <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-text to-muted bg-clip-text text-transparent">
              Configuración
            </h1>
          </div>

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
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}
