"use client";

import { useEffect, useMemo, useState } from "react";
import { LuKeyRound, LuPlus, LuSearch, LuStar, LuArrowUpRight, LuPencil } from "react-icons/lu";
import AccessModal from "@/components/AccessModal";
import { PageHeader, PageShell, SessionLoading } from "@/components/ui";
import {
  createWebAccess,
  deleteWebAccess,
  fetchWebAccesses,
  normalizeUrl,
  sectionColor,
  updateWebAccess,
  type WebAccess,
  type WebAccessInput,
} from "@/lib/accesses";
import { useSession } from "@/lib/useSession";

function SectionPill({ section }: { section: string }) {
  const c = sectionColor(section);
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {section}
    </span>
  );
}

function AccessTable({
  rows,
  onToggleFav,
  onEdit,
}: {
  rows: WebAccess[];
  onToggleFav: (a: WebAccess) => void;
  onEdit: (a: WebAccess) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line bg-panel2/40 text-left text-muted">
              <th className="w-10 px-4 py-2.5 text-eyebrow">★</th>
              <th className="px-4 py-2.5 text-eyebrow">Plataforma</th>
              <th className="px-4 py-2.5 text-eyebrow">Sección</th>
              <th className="px-4 py-2.5 text-eyebrow">Correo</th>
              <th className="px-4 py-2.5 text-eyebrow">Contraseña</th>
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const href = normalizeUrl(a.url);
              return (
                <tr key={a.id} className="border-b border-line/60 last:border-0 hover:bg-panel2/40">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onToggleFav(a)}
                      aria-label={a.favorite ? "Quitar de favoritas" : "Marcar como favorita"}
                      className={a.favorite ? "text-amber-400" : "text-line hover:text-amber-400"}
                    >
                      <LuStar className="h-4 w-4" fill={a.favorite ? "currentColor" : "none"} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-bold uppercase text-text hover:text-brand"
                      >
                        {a.name}
                        <LuArrowUpRight className="h-3 w-3 text-muted" />
                      </a>
                    ) : (
                      <span className="text-sm font-bold uppercase text-text">{a.name}</span>
                    )}
                    {a.notes && <p className="mt-0.5 text-[11px] text-muted">{a.notes}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <SectionPill section={a.section} />
                  </td>
                  <td className="px-4 py-3 text-muted">{a.email || "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {a.password_note ? (
                      <span>
                        <span className="tracking-widest">••••••••</span>{" "}
                        <span className="italic">consultar en {a.password_note}</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onEdit(a)}
                      aria-label="Editar"
                      className="text-muted hover:text-text"
                    >
                      <LuPencil className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AccesosPage() {
  const currentUser = useSession();
  const [items, setItems] = useState<WebAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<string>("");
  const [modal, setModal] = useState<{ open: boolean; access: WebAccess | null }>({
    open: false,
    access: null,
  });

  const load = async () => {
    try {
      setItems(await fetchWebAccesses());
    } catch (err) {
      console.error("Error al cargar accesos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) load();
  }, [currentUser]);

  const sections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of items) counts.set(a.section, (counts.get(a.section) ?? 0) + 1);
    return Array.from(counts.entries()).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => {
      if (section && a.section !== section) return false;
      if (!q) return true;
      return `${a.name} ${a.section} ${a.email ?? ""} ${a.notes ?? ""}`.toLowerCase().includes(q);
    });
  }, [items, search, section]);

  const toggleFav = async (a: WebAccess) => {
    setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, favorite: !x.favorite } : x)));
    try {
      await updateWebAccess(a.id, { favorite: !a.favorite });
    } catch (err) {
      console.error(err);
      await load();
    }
  };

  const handleSave = async (input: WebAccessInput, id?: string) => {
    if (id) await updateWebAccess(id, input);
    else await createWebAccess(input);
    await load();
  };

  if (!currentUser) return <SessionLoading />;

  const favorites = filtered.filter((a) => a.favorite);
  const groups = sections
    .map(([name]) => ({ name, rows: filtered.filter((a) => a.section === name && !a.favorite) }))
    .filter((g) => g.rows.length > 0);

  return (
    <PageShell profile={currentUser}>
        <div className="space-y-5 p-6">
          <PageHeader
            crumb="Operación › Accesos Web"
            title={
              <>
                <LuKeyRound className="h-6 w-6 text-text" />
                Accesos Web
              </>
            }
            className="flex items-end justify-between gap-3"
          >
            <button
              onClick={() => setModal({ open: true, access: null })}
              className="flex items-center gap-1 rounded-md bg-gradient-to-r from-brand to-brand2 px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110"
            >
              <LuPlus className="h-3.5 w-3.5" /> Nueva
            </button>
          </PageHeader>

          <div className="relative max-w-md">
            <LuSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar plataforma, sección o correo..."
              className="w-full rounded-xl border border-line bg-panel py-2.5 pl-9 pr-3 text-xs text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[["", items.length] as [string, number], ...sections].map(([name, count]) => {
              const active = section === name;
              return (
                <button
                  key={name || "todos"}
                  onClick={() => setSection(name)}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
                    active
                      ? "border-text bg-text text-panel"
                      : "border-line bg-panel text-text hover:bg-panel2"
                  }`}
                >
                  {name || "Todos"} <span className={active ? "opacity-70" : "text-muted"}>{count}</span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="p-4 text-xs text-muted">Cargando accesos...</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-panel p-10 text-center text-xs text-muted">
              Aún no hay accesos. Usa &quot;Nueva&quot; para agregar la primera plataforma o recurso.
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-xs italic text-muted">Sin resultados.</p>
          ) : (
            <div className="space-y-6">
              {favorites.length > 0 && (
                <section className="space-y-2">
                  <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    <LuStar className="h-3.5 w-3.5 text-amber-400" fill="currentColor" /> Favoritas
                    <span className="font-normal">{favorites.length}</span>
                  </h2>
                  <AccessTable
                    rows={favorites}
                    onToggleFav={toggleFav}
                    onEdit={(a) => setModal({ open: true, access: a })}
                  />
                </section>
              )}
              {groups.map((g) => (
                <section key={g.name} className="space-y-2">
                  <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                    {g.name} <span className="font-normal">{g.rows.length}</span>
                  </h2>
                  <AccessTable
                    rows={g.rows}
                    onToggleFav={toggleFav}
                    onEdit={(a) => setModal({ open: true, access: a })}
                  />
                </section>
              ))}
            </div>
          )}
        </div>

      <AccessModal
        isOpen={modal.open}
        access={modal.access}
        sections={sections.map(([n]) => n)}
        defaultSection={section || undefined}
        onClose={() => setModal({ open: false, access: null })}
        onSave={handleSave}
        onDelete={async (id) => {
          await deleteWebAccess(id);
          await load();
        }}
      />
    </PageShell>
  );
}
