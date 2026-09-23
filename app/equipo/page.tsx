"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuMail, LuPlus, LuTrash2 } from "react-icons/lu";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import TeamMemberModal from "@/components/TeamMemberModal";
import { ROLE_LABEL, type Profile } from "@/lib/types";
import { addTeamMember, deleteTeamMember, fetchTeam } from "@/lib/team";
import { createClient } from "@/lib/supabase/client";

export default function EquipoPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [team, setTeam] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: userProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
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

  const load = async () => {
    try {
      setTeam(await fetchTeam());
    } catch (err) {
      console.error("Error al cargar el equipo:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingAuth) load();
  }, [loadingAuth]);

  const handleDelete = async (m: Profile) => {
    const ok = window.confirm(
      `¿Eliminar por completo a ${m.full_name || m.email}? Se borrará su perfil y su acceso al dashboard. Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    setSuccessMsg(null);
    setErrorMsg(null);
    setDeletingId(m.id);
    try {
      await deleteTeamMember(m.id);
      setSuccessMsg(`${m.full_name || m.email} fue eliminado del equipo.`);
      await load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  };

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

  const isAdmin = currentUser.role === "admin";

  return (
    <div className="flex h-screen text-text">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto bg-ink">
        <TopBar profile={currentUser} onLogout={handleLogout} />

        <div className="space-y-5 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-xs text-muted">Operación › Equipo</span>
              <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-text to-muted bg-clip-text text-transparent">
                Equipo
              </h1>
            </div>
            {isAdmin && (
              <button
                onClick={() => setIsAddOpen(true)}
                className="flex items-center gap-1 rounded-md bg-gradient-to-r from-brand to-brand2 px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110"
              >
                <LuPlus className="h-3.5 w-3.5" /> Agregar integrante
              </button>
            )}
          </div>

          {successMsg && <p className="text-xs text-emerald-600">{successMsg}</p>}
          {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

          {loading ? (
            <div className="p-4 text-xs text-muted">Cargando equipo...</div>
          ) : team.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center text-xs text-muted">
              Aún no hay integrantes.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {team.map((m) => (
                <div
                  key={m.id}
                  className="relative flex items-center gap-4 rounded-2xl border border-line bg-panel p-5 shadow-sm"
                >
                  {isAdmin && m.id !== currentUser.id && (
                    <button
                      onClick={() => handleDelete(m)}
                      disabled={deletingId === m.id}
                      aria-label={`Eliminar a ${m.full_name || m.email}`}
                      title="Eliminar integrante"
                      className="absolute right-3 top-3 rounded-md p-1.5 text-muted hover:bg-panel2 hover:text-red-500 disabled:opacity-50"
                    >
                      <LuTrash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand2/15 text-sm font-bold text-brand2">
                    {m.initials}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-bold text-text">{m.full_name || "Sin nombre"}</p>
                    <span className="inline-block rounded-full border border-line bg-panel2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {ROLE_LABEL[m.role] ?? m.role}
                    </span>
                    <a
                      href={`mailto:${m.email}`}
                      className="flex items-center gap-1.5 truncate text-xs text-muted hover:text-text"
                    >
                      <LuMail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{m.email}</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <TeamMemberModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreate={async (input) => {
          setSuccessMsg(null);
          await addTeamMember(input);
          setSuccessMsg(`Invitación enviada a ${input.email}.`);
          await load();
        }}
      />
    </div>
  );
}
