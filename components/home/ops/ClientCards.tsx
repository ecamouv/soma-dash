"use client";

import { useState } from "react";
import { LuCheck, LuLink } from "react-icons/lu";
import ClientAvatar from "@/components/home/ops/ClientAvatar";
import { hexToRgba } from "@/lib/clientColors";
import { formatMXN, type Quota } from "@/lib/opsHome";
import type { Client } from "@/lib/types";

export interface ClientCardData {
  client: Client;
  color: string;
  packageLabel: string | null;
  reels: Quota;
  fotos: Quota;
  /** Solo para clientes de pauta: posts publicados / total del mes. */
  posts: Quota;
  inRevision: number;
  /** Estado de cobro en una línea; late = hay adeudo. null = sin cobro configurado. */
  payment: { text: string; late: boolean } | null;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-white/5 px-2 py-1 text-[11px] tabular-nums text-muted">{children}</span>
  );
}

function Card({ data, showMoney }: { data: ClientCardData; showMoney: boolean }) {
  const { client, color, payment } = data;
  const [copied, setCopied] = useState(false);

  const done = data.reels.done + data.fotos.done + data.posts.done;
  const total = data.reels.total + data.fotos.total + data.posts.total;

  const copyLink = async () => {
    if (!client.public_token) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/c/${client.public_token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Error al copiar el enlace:", err);
    }
  };

  return (
    <div
      className="flex min-w-0 flex-col gap-3 rounded-xl border p-4"
      style={{
        borderColor: hexToRgba(color, 0.22),
        borderLeft: `4px solid ${color}`,
        background: `linear-gradient(to bottom right, ${hexToRgba(color, 0.16)}, rgba(255,255,255,0.02) 70%)`,
      }}
    >
      <div className="flex items-start gap-3">
        <ClientAvatar name={client.name} color={color} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-text">{client.name}</p>
          <p className="truncate text-[11px] text-muted">
            {data.packageLabel ?? "Sin paquete"}
            {showMoney && client.price != null && ` · ${formatMXN(client.price)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={copyLink}
          disabled={!client.public_token}
          aria-label="Copiar enlace del calendario del cliente"
          title={copied ? "Enlace copiado" : "Copiar enlace del calendario"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-muted transition hover:text-text disabled:opacity-40"
        >
          {copied ? <LuCheck className="h-4 w-4" /> : <LuLink className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex min-h-7 flex-wrap gap-1.5">
        {data.reels.total > 0 && (
          <Chip>
            Reels {data.reels.done}/{data.reels.total}
          </Chip>
        )}
        {data.fotos.total > 0 && (
          <Chip>
            Fotos {data.fotos.done}/{data.fotos.total}
          </Chip>
        )}
        {data.posts.total > 0 && (
          <Chip>
            Posts {data.posts.done}/{data.posts.total}
          </Chip>
        )}
        {data.inRevision > 0 && <Chip>{data.inRevision} en revisión</Chip>}
      </div>

      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold font-display tabular-nums text-text">{done}</span>
          <span className="text-[11px] text-muted">de {total} publicadas</span>
        </div>
        {showMoney && (
          <span className={`text-right text-[11px] ${payment?.late ? "text-crimson" : "text-muted"}`}>
            {payment?.text ?? "Sin pago configurado"}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ClientCards({
  cards,
  pausedCount,
  showMoney = true,
}: {
  cards: ClientCardData[];
  pausedCount: number;
  /** Precio y estado de cobro: solo para roles que manejan cobro. */
  showMoney?: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-text">Clientes</h2>
        {pausedCount > 0 && (
          <span className="text-[11px] text-muted">
            {pausedCount} {pausedCount === 1 ? "pausado" : "pausados"}
          </span>
        )}
      </div>
      {cards.length === 0 ? (
        <p className="text-xs text-muted">No hay clientes activos.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.client.id} data={c} showMoney={showMoney} />
          ))}
        </div>
      )}
    </section>
  );
}
