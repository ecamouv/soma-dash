"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LuArrowUpRight, LuLoaderCircle, LuPencil, LuPlus, LuTrash2 } from "react-icons/lu";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import type { Client, Profile } from "@/lib/types";
import {
  PLATFORM_LABEL,
  SECTORS,
  addInspiration,
  deleteInspiration,
  fetchInspiration,
  updateInspiration,
  type InspirationItem,
} from "@/lib/inspiration";
import { createClient } from "@/lib/supabase/client";

export default function InspiracionPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<InspirationItem[]>([]);
  const [clients, setClients] = useState<Pick<Client, "id" | "name">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [sector, setSector] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"todo" | "cliente" | "sector">("todo");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(
        (p as Profile) || {
          id: user.id,
          email: user.email || "",
          full_name: user.email?.split("@")[0] || "Usuario",
          role: "prod",
          initials: (user.email || "U").substring(0, 2).toUpperCase(),
        }
      );
      try {
        const [list, cl] = await Promise.all([
          fetchInspiration(),
          supabase.from("clients").select("id, name").eq("paused", false).order("name"),
        ]);
        setItems(list);
        setClients((cl.data ?? []) as Pick<Client, "id" | "name">[]);
      } catch (err) {
        console.error("Error al cargar inspiración:", err);
        setError("No se pudo cargar la inspiración. Revisa que la migración esté aplicada.");
      }
      setLoading(false);
    };
    init();
  }, [router, supabase]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await addInspiration({ url: url.trim(), title, clientId, sector });
      setItems(await fetchInspiration());
      setUrl("");
      setTitle("");
    } catch (err) {
      const e = err as { message?: string; code?: string; details?: string };
      console.error("Error al guardar el link:", e.message, e.code, e.details);
      setError(`No se pudo guardar el link${e.message ? `: ${e.message}` : "."}`);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const prev = items;
    setItems((list) => list.filter((i) => i.id !== id));
    try {
      await deleteInspiration(id);
    } catch (err) {
      console.error("Error al borrar:", err);
      setItems(prev);
      setError("No se pudo borrar.");
    }
  };

  const handleUpdate = async (
    id: string,
    patch: { client_id?: string | null; sector?: string | null }
  ) => {
    const prev = items;
    setItems((list) =>
      list.map((i) =>
        i.id === id
          ? {
              ...i,
              ...patch,
              client:
                patch.client_id === undefined
                  ? i.client
                  : patch.client_id
                    ? { name: clients.find((c) => c.id === patch.client_id)?.name ?? "" }
                    : null,
            }
          : i
      )
    );
    try {
      await updateInspiration(id, patch);
    } catch (err) {
      console.error("Error al actualizar:", err);
      setItems(prev);
      setError("No se pudo actualizar.");
    }
  };

  const groups = (() => {
    if (view === "todo") return [{ key: "todo", label: null as string | null, list: items }];
    const keyOf = (i: InspirationItem) =>
      view === "cliente" ? (i.client?.name ?? "") : (i.sector ?? "");
    const empty = view === "cliente" ? "Sin cliente" : "Sin sector";
    const map = new Map<string, InspirationItem[]>();
    for (const i of items) {
      const k = keyOf(i);
      map.set(k, [...(map.get(k) ?? []), i]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
      .map(([k, list]) => ({ key: k || "__none", label: k || empty, list }));
  })();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (!profile) {
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
        <TopBar profile={profile} onLogout={handleLogout} />

        <div className="max-w-5xl space-y-6 p-6">
          <div>
            <span className="text-xs text-muted">Soma › Inspiración</span>
            <h1 className="text-2xl font-bold font-display text-text">Inspiración</h1>
          </div>

          <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Pega un link de YouTube, TikTok o Instagram"
              className="min-w-64 flex-1 rounded-xl border border-line bg-panel px-3 py-2.5 text-xs text-text outline-none focus:border-brand"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título (opcional)"
              className="w-48 rounded-xl border border-line bg-panel px-3 py-2.5 text-xs text-text outline-none focus:border-brand"
            />
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-40 rounded-xl border border-line bg-panel px-3 py-2.5 text-xs text-text outline-none focus:border-brand"
            >
              <option value="">Sin cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-40 rounded-xl border border-line bg-panel px-3 py-2.5 text-xs text-text outline-none focus:border-brand"
            >
              <option value="">Sin sector</option>
              {SECTORS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!url.trim() || saving}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand to-brand2 px-4 py-2.5 text-xs font-semibold text-on-primary transition hover:brightness-110 disabled:opacity-50"
            >
              {saving ? <LuLoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <LuPlus className="h-3.5 w-3.5" />}
              Guardar
            </button>
          </form>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-1 rounded-xl border border-line bg-panel p-1 text-xs font-semibold w-fit">
            {(
              [
                ["todo", "Todo"],
                ["cliente", "Por cliente"],
                ["sector", "Por sector"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-lg px-3 py-1.5 transition ${
                  view === v ? "bg-panel2 text-text" : "text-muted hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-xs text-muted">Cargando...</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted">Aún no hay referencias guardadas.</p>
          ) : (
            <div className="space-y-8">
              {groups.map((g) => (
                <section key={g.key} className="space-y-3">
                  {g.label && (
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-sm font-bold text-text">{g.label}</h2>
                      <span className="text-[11px] text-muted">{g.list.length}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {g.list.map((item) => (
                <div
                  key={item.id}
                  className="group overflow-hidden rounded-2xl border border-line bg-panel shadow-sm"
                >
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                    <div className="relative aspect-video bg-panel2">
                      {item.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnail_url}
                          alt=""
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-semibold uppercase text-muted">
                          {PLATFORM_LABEL[item.platform]}
                        </div>
                      )}
                      <LuArrowUpRight className="absolute right-2 top-2 h-4 w-4 rounded-full bg-black/50 p-0.5 text-white opacity-0 transition group-hover:opacity-100" />
                    </div>
                  </a>
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-2 text-xs font-semibold text-text">
                      {item.title || new URL(item.url).hostname.replace(/^www\./, "")}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted">
                      <span>{PLATFORM_LABEL[item.platform]}</span>
                      {item.client?.name && <span>· {item.client.name}</span>}
                      {item.sector && <span>· {item.sector}</span>}
                      <button
                        onClick={() => setEditingId(editingId === item.id ? null : item.id)}
                        aria-label="Editar cliente y sector"
                        className="ml-auto opacity-0 transition hover:text-text group-hover:opacity-100"
                      >
                        <LuPencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        aria-label="Borrar"
                        className="opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                      >
                        <LuTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {editingId === item.id && (
                      <div className="flex gap-1.5 pt-1">
                        <select
                          value={item.client_id ?? ""}
                          onChange={(e) => handleUpdate(item.id, { client_id: e.target.value || null })}
                          className="min-w-0 flex-1 rounded-lg border border-line bg-panel2 px-2 py-1 text-[11px] text-text outline-none"
                        >
                          <option value="">Sin cliente</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={item.sector ?? ""}
                          onChange={(e) => handleUpdate(item.id, { sector: e.target.value || null })}
                          className="min-w-0 flex-1 rounded-lg border border-line bg-panel2 px-2 py-1 text-[11px] text-text outline-none"
                        >
                          <option value="">Sin sector</option>
                          {SECTORS.map((sec) => (
                            <option key={sec} value={sec}>
                              {sec}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
