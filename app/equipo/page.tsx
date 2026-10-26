"use client";

import { useEffect, useState } from "react";
import { LuMail, LuPlus, LuTrash2 } from "react-icons/lu";
import { isAdminRole, useEffectiveRole } from "@/lib/roleView";
import TeamMemberModal from "@/components/TeamMemberModal";
import { PageHeader, PageShell, SessionLoading } from "@/components/ui";
import { ROLE_LABEL, type Profile } from "@/lib/types";
import { addTeamMember, deleteTeamMember, fetchTeam } from "@/lib/team";
import { useSession } from "@/lib/useSession";
import { errText } from "@/lib/utils";

export default function EquipoPage() {
  const currentUser = useSession();
  const role = useEffectiveRole(currentUser?.role);
  const [team, setTeam] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    if (currentUser) load();
  }, [currentUser]);

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
      setErrorMsg(errText(err));
    } finally {
      setDeletingId(null);
    }
  };

  if (!currentUser) return <SessionLoading />;

  const isAdmin = isAdminRole(role);

  return (
    <PageShell profile={currentUser}>
      <div className="space-y-5 p-6">
        <PageHeader crumb="Operación › Equipo" title="Equipo">
          {isAdmin && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1 rounded-md bg-gradient-to-r from-brand to-brand2 px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110"
            >
              <LuPlus className="h-3.5 w-3.5" /> Agregar integrante
            </button>
          )}
        </PageHeader>

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
    </PageShell>
  );
}
