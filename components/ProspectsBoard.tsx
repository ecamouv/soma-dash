"use client";

import { useMemo, useState } from "react";
import { LuInstagram, LuFacebook, LuGlobe, LuPhone, LuMail, LuPlus, LuLayoutGrid, LuTable } from "react-icons/lu";
import { FaTiktok } from "react-icons/fa6";
import {
  PROSPECT_STAGES,
  PROSPECT_STAGE_COLOR,
  PROSPECT_STAGE_LABEL,
  type Profile,
  type Prospect,
  type ProspectStage,
} from "@/lib/types";
import { socialUrl } from "@/lib/prospects";

interface Props {
  prospects: Prospect[];
  profiles: Profile[];
  onOpen: (prospect: Prospect) => void;
  onNew: () => void;
  onMoveStage: (prospect: Prospect, stage: ProspectStage) => Promise<void>;
}

const selectCls =
  "rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-brand";

function formatMoney(v?: number | null) {
  if (v == null) return null;
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StageBadge({ stage }: { stage: ProspectStage }) {
  const color = PROSPECT_STAGE_COLOR[stage];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}1A`, color }}
    >
      {PROSPECT_STAGE_LABEL[stage]}
    </span>
  );
}

function Socials({ p }: { p: Prospect }) {
  const items = [
    { href: socialUrl("instagram", p.instagram), Icon: LuInstagram, label: "Instagram" },
    { href: socialUrl("facebook", p.facebook), Icon: LuFacebook, label: "Facebook" },
    { href: socialUrl("tiktok", p.tiktok), Icon: FaTiktok, label: "TikTok" },
    { href: socialUrl("website", p.website), Icon: LuGlobe, label: "Sitio web" },
    { href: p.phone ? `https://wa.me/${p.phone.replace(/\D/g, "")}` : null, Icon: LuPhone, label: "WhatsApp" },
    { href: p.email ? `mailto:${p.email}` : null, Icon: LuMail, label: "Correo" },
  ].filter((i) => i.href);
  if (items.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      {items.map(({ href, Icon, label }) => (
        <a
          key={label}
          href={href!}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          onClick={(e) => e.stopPropagation()}
          className="text-muted hover:text-text"
        >
          <Icon className="h-3.5 w-3.5" />
        </a>
      ))}
    </div>
  );
}

function NextStep({ p }: { p: Prospect }) {
  if (!p.next_step && !p.next_step_date) return null;
  const overdue = !!p.next_step_date && p.next_step_date < todayISO() && p.stage !== "ganado" && p.stage !== "perdido";
  return (
    <p className={`text-[11px] ${overdue ? "font-semibold text-red-500" : "text-muted"}`}>
      {p.next_step || "Siguiente paso"}
      {p.next_step_date ? ` · ${p.next_step_date}` : ""}
    </p>
  );
}

export default function ProspectsBoard({ prospects, profiles, onOpen, onNew, onMoveStage }: Props) {
  const [view, setView] = useState<"kanban" | "tabla">("kanban");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const markets = useMemo(
    () => Array.from(new Set(prospects.map((p) => p.market?.trim()).filter(Boolean) as string[])).sort(),
    [prospects]
  );
  const ownerName = (id?: string | null) => {
    const p = profiles.find((x) => x.id === id);
    return p ? p.full_name || p.email : "—";
  };

  const filtered = prospects.filter((p) => {
    if (stageFilter && p.stage !== stageFilter) return false;
    if (marketFilter && p.market !== marketFilter) return false;
    if (ownerFilter && p.owner_id !== ownerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${p.name} ${p.contact_name ?? ""}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${selectCls} w-56`}
          placeholder="Buscar prospecto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={selectCls} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">Todas las etapas</option>
          {PROSPECT_STAGES.map((s) => (
            <option key={s} value={s}>{PROSPECT_STAGE_LABEL[s]}</option>
          ))}
        </select>
        <select className={selectCls} value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)}>
          <option value="">Todos los mercados</option>
          {markets.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select className={selectCls} value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
          <option value="">Todos los responsables</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-line">
            <button
              onClick={() => setView("kanban")}
              title="Kanban"
              className={`px-2.5 py-1.5 ${view === "kanban" ? "bg-panel2 text-text" : "text-muted"}`}
            >
              <LuLayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("tabla")}
              title="Tabla"
              className={`px-2.5 py-1.5 ${view === "tabla" ? "bg-panel2 text-text" : "text-muted"}`}
            >
              <LuTable className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={onNew}
            className="flex items-center gap-1 rounded-md bg-gradient-to-r from-brand to-brand2 px-4 py-2 text-xs font-semibold text-white shadow hover:brightness-110"
          >
            <LuPlus className="h-3.5 w-3.5" /> Agregar prospecto
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}
        >
          {PROSPECT_STAGES.map((stage) => {
            const items = filtered.filter((p) => p.stage === stage);
            return (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const p = prospects.find((x) => x.id === dragId);
                  if (p && p.stage !== stage) onMoveStage(p, stage);
                  setDragId(null);
                }}
                className="min-w-0 self-start rounded-2xl border border-line bg-panel2/40 p-2"
              >
                <div className="mb-2 flex items-center justify-between px-2 pt-1">
                  <StageBadge stage={stage} />
                  <span className="text-[11px] text-muted">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onClick={() => onOpen(p)}
                      className="cursor-pointer space-y-1.5 rounded-xl border border-line bg-panel p-3 shadow-sm hover:border-brand/40"
                    >
                      <p className="text-xs font-semibold text-text">{p.name}</p>
                      {p.contact_name && <p className="text-[11px] text-muted">{p.contact_name}</p>}
                      {p.market && (
                        <span className="inline-block rounded-full border border-line bg-panel2 px-2 py-0.5 text-[10px] text-muted">
                          {p.market}
                        </span>
                      )}
                      <NextStep p={p} />
                      <div className="flex items-center justify-between">
                        <Socials p={p} />
                        {formatMoney(p.estimated_value) && (
                          <span className="text-[11px] font-medium text-muted">{formatMoney(p.estimated_value)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="px-2 py-3 text-center text-[11px] italic text-muted">Vacío</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line bg-panel2/40 text-left text-muted">
                  <th className="px-4 py-2.5 text-eyebrow">Prospecto</th>
                  <th className="px-4 py-2.5 text-eyebrow">Etapa</th>
                  <th className="px-4 py-2.5 text-eyebrow">Contacto</th>
                  <th className="px-4 py-2.5 text-eyebrow">Mercado</th>
                  <th className="px-4 py-2.5 text-eyebrow">Redes</th>
                  <th className="px-4 py-2.5 text-eyebrow">Siguiente paso</th>
                  <th className="px-4 py-2.5 text-eyebrow">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onOpen(p)}
                    className="cursor-pointer border-b border-line/60 last:border-0 hover:bg-panel2/40"
                  >
                    <td className="px-4 py-3 font-medium text-text">{p.name}</td>
                    <td className="px-4 py-3"><StageBadge stage={p.stage} /></td>
                    <td className="px-4 py-3 text-muted">{p.contact_name || "—"}</td>
                    <td className="px-4 py-3 text-muted">{p.market || "—"}</td>
                    <td className="px-4 py-3"><Socials p={p} /></td>
                    <td className="px-4 py-3"><NextStep p={p} /></td>
                    <td className="px-4 py-3 text-muted">{ownerName(p.owner_id)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center italic text-muted">
                      No hay prospectos con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
