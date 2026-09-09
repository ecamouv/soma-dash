"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LuUsers, LuSnowflake, LuReceipt } from "react-icons/lu";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import NewClientModal from "@/components/NewClientModal";
import PauseClientModal from "@/components/PauseClientModal";
import PaymentsModal from "@/components/PaymentsModal";
import type { Client, Profile } from "@/lib/types";
import { createClientWithPackage, fetchClients, setClientPaused } from "@/lib/events";
import { createClient } from "@/lib/supabase/client";
import { PACKAGES } from "@/lib/packages";

export default function SomaHomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [clients, setClients] = useState<Client[]>([]);
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const [isPauseClientOpen, setIsPauseClientOpen] = useState(false);
  const [isPaymentsOpen, setIsPaymentsOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadClients = async () => {
    try {
      setClients(await fetchClients());
    } catch (err) {
      console.error("Error al cargar clientes:", err);
    }
  };

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

  useEffect(() => {
    if (!loadingAuth) loadClients();
  }, [loadingAuth]);

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

  const handleCreateClient: React.ComponentProps<typeof NewClientModal>["onCreate"] = async (input) => {
    setSuccessMsg(null);
    await createClientWithPackage(input.name, input.packageValue);
    setSuccessMsg(`Cliente "${input.name}" agregado con ${PACKAGES[input.packageValue].label}.`);
    await loadClients();
  };

  const handlePauseClient = async (clientId: string) => {
    await setClientPaused(clientId, true);
    await loadClients();
  };

  const handleResumeClient = async (clientId: string) => {
    await setClientPaused(clientId, false);
    await loadClients();
  };

  return (
    <div className="flex h-screen text-text">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto bg-ink">
        <TopBar profile={currentUser} onLogout={handleLogout} />

        <div className="p-6 space-y-6 max-w-4xl">
          <div>
            <span className="text-xs text-muted">Soma</span>
            <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-text to-muted bg-clip-text text-transparent">Bienvenido a Soma</h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
              <div className="h-1 bg-gradient-to-r from-brand to-brand2" />
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand/20 to-brand2/20 text-brand2">
                    <LuUsers className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text">Clientes</h2>
                    <p className="text-[11px] text-muted">Agrega un cliente y su paquete de contenido</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNewClientOpen(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-brand to-brand2 hover:brightness-110 rounded-md shadow"
                >
                  + Agregar Cliente
                </button>
                {successMsg && <p className="text-xs text-emerald-400">{successMsg}</p>}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
              <div className="h-1 bg-gradient-to-r from-blue-600 to-blue-400" />
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                    <LuSnowflake className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text">Pausar cliente</h2>
                    <p className="text-[11px] text-muted">Congela su logística sin borrar nada</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPauseClientOpen(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:brightness-110 rounded-md shadow"
                >
                  Pausar / Reanudar
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
              <div className="h-1 bg-gradient-to-r from-emerald-600 to-emerald-400" />
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <LuReceipt className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-text">Pagos</h2>
                    <p className="text-[11px] text-muted">Registra fechas de pago por cliente</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPaymentsOpen(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 rounded-md shadow"
                >
                  + Agregar pago
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NewClientModal
        isOpen={isNewClientOpen}
        onClose={() => setIsNewClientOpen(false)}
        onCreate={handleCreateClient}
      />

      <PauseClientModal
        isOpen={isPauseClientOpen}
        onClose={() => setIsPauseClientOpen(false)}
        clients={clients}
        onPause={handlePauseClient}
        onResume={handleResumeClient}
      />

      <PaymentsModal
        isOpen={isPaymentsOpen}
        onClose={() => setIsPaymentsOpen(false)}
        clients={clients}
      />
    </div>
  );
}
