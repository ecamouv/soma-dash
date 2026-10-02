"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { LuMinus, LuPlus } from "react-icons/lu";
import type { Client } from "@/lib/types";
import { defaultClientColor } from "@/lib/clientColors";
import {
  fetchPautaPosts,
  fetchPautaSettings,
  missingPostCount,
  savePostsPerWeek,
  syncPautaMonth,
  updatePautaPost,
  weeksInMonth,
  type PautaPost,
} from "@/lib/pauta";

// Tope del selector de posts por semana. Es solo un límite de la interfaz.
const MAX_POSTS_PER_WEEK = 14;

interface Props {
  // Clientes con paquete "Solamente Pauta" (ya sin pausados y con el filtro de cliente aplicado).
  clients: Client[];
  // Orden de todos los clientes, para que el color automático coincida con Entregas.
  allClients: Client[];
  month: Date;
  // Posts compartidos con el calendario de la página: un cambio aquí se ve allá y viceversa.
  posts: PautaPost[];
  setPosts: Dispatch<SetStateAction<PautaPost[]>>;
  // Rango (YYYY-MM-DD) de la cuadrícula visible del calendario.
  rangeStart: string;
  rangeEnd: string;
  onError: (message: string | null) => void;
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return String(err);
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function formatDateLabel(iso: string): string {
  const d = parseISO(iso);
  const weekday = d.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", "");
  return `${weekday} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PautaSection({ clients, allClients, month, posts, setPosts, rangeStart, rangeEnd, onError }: Props) {
  const year = month.getFullYear();
  const monthNumber = month.getMonth() + 1;
  const weeks = weeksInMonth(year, month.getMonth());

  const [settings, setSettings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const [setupMissing, setSetupMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchPautaSettings(), fetchPautaPosts(year, monthNumber, rangeStart, rangeEnd)])
      .then(([s, p]) => {
        if (cancelled) return;
        setSettings(s);
        setPosts(p);
        setSetupMissing(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error al cargar posts de pauta:", err);
        setSetupMissing(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, monthNumber, rangeStart, rangeEnd, setPosts]);

  const colorOf = (clientId: string) => {
    const client = allClients.find((c) => c.id === clientId);
    const index = allClients.findIndex((c) => c.id === clientId);
    return client?.color || defaultClientColor(Math.max(index, 0));
  };

  const postsByClient = useMemo(() => {
    const map = new Map<string, PautaPost[]>();
    for (const p of posts) {
      // La lista muestra solo los posts de este mes; el resto (fechas de relleno) es del calendario.
      if (p.year !== year || p.month !== monthNumber) continue;
      const list = map.get(p.client_id) ?? [];
      list.push(p);
      map.set(p.client_id, list);
    }
    return map;
  }, [posts, year, monthNumber]);

  const reloadClientPosts = async (clientId: string) => {
    const fresh = await fetchPautaPosts(year, monthNumber, rangeStart, rangeEnd);
    setPosts((prev) => [...prev.filter((p) => p.client_id !== clientId), ...fresh.filter((p) => p.client_id === clientId)]);
  };

  // Guarda la cantidad semanal y deja el mes visible con esa cantidad de posts.
  const applyPostsPerWeek = async (clientId: string, next: number) => {
    const clamped = Math.min(Math.max(next, 0), MAX_POSTS_PER_WEEK);
    setBusyClientId(clientId);
    onError(null);
    try {
      await savePostsPerWeek(clientId, clamped);
      setSettings((prev) => ({ ...prev, [clientId]: clamped }));
      await syncPautaMonth(clientId, year, monthNumber, clamped, postsByClient.get(clientId) ?? []);
      await reloadClientPosts(clientId);
    } catch (err) {
      console.error("Error al actualizar posts por semana:", err);
      onError(`No se pudo actualizar los posts semanales: ${errText(err)}`);
    } finally {
      setBusyClientId(null);
    }
  };

  const generateMonth = async (clientId: string) => {
    setBusyClientId(clientId);
    onError(null);
    try {
      await syncPautaMonth(clientId, year, monthNumber, settings[clientId] ?? 0, postsByClient.get(clientId) ?? []);
      await reloadClientPosts(clientId);
    } catch (err) {
      console.error("Error al generar posts del mes:", err);
      onError(`No se pudieron generar los posts: ${errText(err)}`);
    } finally {
      setBusyClientId(null);
    }
  };

  const patchPost = async (
    post: PautaPost,
    patch: Partial<Pick<PautaPost, "name" | "scheduled_date" | "published">>
  ) => {
    onError(null);
    const previous = post;
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...patch } : p)));
    try {
      await updatePautaPost(post.id, patch);
    } catch (err) {
      console.error("Error al guardar el post:", err);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? previous : p)));
      onError(`No se pudo guardar ${post.name}: ${errText(err)}`);
    }
  };

  // Cambia la fecha de un post. Con `applyToAll`, el mismo cambio se replica en el post
  // del mismo número de las demás semanas del mes, conservando el día de la semana
  // (misma fecha desplazada +7 días por cada semana de diferencia).
  const setPostDate = async (post: PautaPost, date: string | null, applyToAll: boolean) => {
    if (!applyToAll) {
      await patchPost(post, { scheduled_date: date });
      return;
    }
    onError(null);
    const targets = (postsByClient.get(post.client_id) ?? []).filter((p) => p.slot === post.slot);
    const nextDate = (p: PautaPost) => (date ? shiftDays(date, 7 * (p.week - post.week)) : null);
    const byId = new Map(targets.map((p) => [p.id, nextDate(p)]));
    setPosts((prev) => prev.map((p) => (byId.has(p.id) ? { ...p, scheduled_date: byId.get(p.id) ?? null } : p)));
    try {
      await Promise.all(targets.map((p) => updatePautaPost(p.id, { scheduled_date: nextDate(p) })));
    } catch (err) {
      console.error("Error al aplicar la fecha a todas las semanas:", err);
      onError(`No se pudo aplicar la fecha a todos los Post ${post.slot}: ${errText(err)}`);
      await reloadClientPosts(post.client_id).catch(() => undefined);
    }
  };

  if (setupMissing) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-text">Clientes de pauta</h2>
        <div className="rounded-xl border border-line bg-panel2/50 px-4 py-3 text-[11px] text-muted">
          Falta crear las tablas de pauta en Supabase. Aplica la migración{" "}
          <span className="font-mono text-text">20261002000000_pauta_posts.sql</span> y recarga la página.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-bold text-text">Clientes de pauta</h2>
      </div>

      {loading ? (
        <div className="text-xs text-muted p-4">Cargando clientes de pauta...</div>
      ) : clients.length === 0 ? (
        <div className="rounded-2xl border border-line bg-panel px-4 py-6 text-center text-xs text-muted italic">
          Ningún cliente con paquete Solamente Pauta.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {clients.map((client) => {
            const clientPosts = postsByClient.get(client.id) ?? [];
            const perWeek = settings[client.id] ?? 0;
            const busy = busyClientId === client.id;
            const missing = missingPostCount(clientPosts, perWeek, weeks);
            const color = colorOf(client.id);

            const byWeek = new Map<number, PautaPost[]>();
            for (const p of clientPosts) {
              const list = byWeek.get(p.week) ?? [];
              list.push(p);
              byWeek.set(p.week, list);
            }
            const weekNumbers = [...byWeek.keys()].sort((a, b) => a - b);

            return (
              <div key={client.id} className="rounded-2xl border border-line bg-panel p-3 space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-3 px-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <h3 className="truncate text-sm font-bold text-text">{client.name}</h3>
                    <span className="shrink-0 text-[11px] font-mono text-muted">({clientPosts.length})</span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[10px] text-muted">Posts por semana</span>
                    <div className="flex items-center rounded-md border border-line bg-panel2">
                      <button
                        type="button"
                        disabled={busy || perWeek <= 0}
                        onClick={() => applyPostsPerWeek(client.id, perWeek - 1)}
                        aria-label="Menos posts por semana"
                        className="px-1.5 py-1 text-muted hover:text-text disabled:opacity-30"
                      >
                        <LuMinus className="h-3 w-3" />
                      </button>
                      <span className="min-w-[1.5rem] text-center font-mono text-xs text-text">{perWeek}</span>
                      <button
                        type="button"
                        disabled={busy || perWeek >= MAX_POSTS_PER_WEEK}
                        onClick={() => applyPostsPerWeek(client.id, perWeek + 1)}
                        aria-label="Más posts por semana"
                        className="px-1.5 py-1 text-muted hover:text-text disabled:opacity-30"
                      >
                        <LuPlus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {clientPosts.length === 0 && (
                  <div className="px-2 py-3 text-center text-[11px] text-muted italic">
                    {perWeek === 0
                      ? "Elige cuántos posts por semana para generar los del mes."
                      : "Sin posts este mes."}
                  </div>
                )}

                {missing > 0 && perWeek > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => generateMonth(client.id)}
                    className="w-full rounded-md border border-dashed border-line px-3 py-1.5 text-[11px] text-muted hover:border-brand2/60 hover:text-text disabled:opacity-40 transition"
                  >
                    Generar {missing} {missing === 1 ? "post" : "posts"} de {perWeek} por semana
                  </button>
                )}

                <div className="space-y-2">
                  {weekNumbers.map((week) => (
                    <div key={week} className="space-y-1">
                      <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Semana {week}
                      </div>
                      {(byWeek.get(week) ?? []).map((post) => (
                        <PostRow key={post.id} post={post} onPatch={patchPost} onSetDate={setPostDate} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PostRow({
  post,
  onPatch,
  onSetDate,
}: {
  post: PautaPost;
  onPatch: (
    post: PautaPost,
    patch: Partial<Pick<PautaPost, "name" | "scheduled_date" | "published">>
  ) => void;
  onSetDate: (post: PautaPost, date: string | null, applyToAll: boolean) => void;
}) {
  const [name, setName] = useState(post.name);
  useEffect(() => setName(post.name), [post.name]);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(post.name);
      return;
    }
    if (trimmed !== post.name) onPatch(post, { name: trimmed });
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
        post.published ? "border-emerald-500/30 bg-emerald-500/10" : "border-line bg-panel2"
      }`}
    >
      <input
        type="checkbox"
        checked={post.published}
        onChange={(e) => onPatch(post, { published: e.target.checked })}
        aria-label={`Marcar ${post.name} como publicado`}
        className="h-3.5 w-3.5 shrink-0 accent-emerald-500"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setName(post.name);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={`min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[11px] font-semibold outline-none focus:bg-panel focus:ring-1 focus:ring-brand2/60 ${
          post.published ? "text-emerald-300" : "text-text"
        }`}
      />
      <DatePicker post={post} onSetDate={onSetDate} />
    </div>
  );
}

// Selector de fecha con checkmark: si está marcado, la fecha se aplica al mismo número de
// post en todas las semanas del mes; si no, solo cambia este post.
function DatePicker({
  post,
  onSetDate,
}: {
  post: PautaPost;
  onSetDate: (post: PautaPost, date: string | null, applyToAll: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(post.scheduled_date ?? "");
  const [applyToAll, setApplyToAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openPicker = () => {
    setDraft(post.scheduled_date ?? "");
    setApplyToAll(false);
    setOpen((o) => !o);
  };

  const save = (date: string | null) => {
    onSetDate(post, date, applyToAll);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={openPicker}
        aria-label={`Fecha de publicación de ${post.name}`}
        className={`rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] hover:border-brand2/60 hover:text-text transition ${
          post.scheduled_date ? "font-mono text-text" : "text-muted italic"
        }`}
      >
        {post.scheduled_date ? formatDateLabel(post.scheduled_date) : "Sin fecha"}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 space-y-2 rounded-lg border border-line bg-panel p-2.5 shadow-elevated">
          <input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-md border border-line bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-brand2"
          />
          <label className="flex cursor-pointer items-start gap-2 text-[11px] text-text">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-emerald-500"
            />
            <span>
              Aplicar a todos los Post {post.slot} de este mes
              <span className="block text-[10px] text-muted">Mismo día de la semana en cada semana.</span>
            </span>
          </label>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => save(null)}
              className="text-[11px] text-muted hover:text-text"
            >
              Quitar fecha
            </button>
            <button
              type="button"
              disabled={!draft}
              onClick={() => save(draft)}
              className="rounded-md bg-brand px-3 py-1 text-[11px] font-semibold text-on-primary hover:bg-brand2 disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
