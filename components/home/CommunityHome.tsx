"use client";

import { useEffect, useMemo, useState } from "react";
import AtRiskPanel from "@/components/home/community/AtRiskPanel";
import PautaPending from "@/components/home/community/PautaPending";
import ClientCards, { type ClientCardData } from "@/components/home/ops/ClientCards";
import { ErrorBanner, PageHeader, PageShell } from "@/components/ui";
import { buildClientColorMap } from "@/lib/clientColors";
import { atRisk, publishQueue, unscheduledPauta } from "@/lib/communityHome";
import { fetchCommunityHome, type CommunityHomeData } from "@/lib/communityHomeData";
import { monthProgress, pautaProgress } from "@/lib/opsHome";
import { usePackages } from "@/lib/usePackages";
import type { Profile } from "@/lib/types";
import { iso, weeksInMonth } from "@/lib/utils";

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <p className={`text-3xl font-bold font-display tabular-nums ${tone || "text-text"}`}>{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

export default function CommunityHome({ profile }: { profile: Profile }) {
  const todayISO = iso(new Date());
  const { packages } = usePackages();
  const [data, setData] = useState<CommunityHomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCommunityHome(todayISO)
      .then((d) => !cancelled && setData(d))
      .catch((err) => {
        console.error("Error al cargar la home de Community:", err);
        if (!cancelled) setError("No se pudo cargar el resumen de community.");
      });
    return () => {
      cancelled = true;
    };
  }, [todayISO]);

  const view = useMemo(() => {
    if (!data) return null;
    const colorMap = buildClientColorMap(data.clients);
    const activeClients = data.clients.filter((c) => !c.paused);
    const active = new Set(activeClients.map((c) => c.id));
    const clientNames = new Map(data.clients.map((c) => [c.id, c.name]));

    const pieces = data.pieces.filter((p) => active.has(p.client_id));
    const pautaPosts = data.pautaPosts.filter((p) => active.has(p.client_id));
    const maxWeek = weeksInMonth(data.year, data.month - 1);

    const queue = publishQueue(pieces, pautaPosts, todayISO);
    const risk = atRisk(queue, todayISO);

    const cards: ClientCardData[] = activeClients.map((client) => {
      const pkg = client.package ? packages[client.package] : undefined;
      const { reels, fotos } = monthProgress(
        pieces,
        client.id,
        data.month,
        pkg ? { reels: pkg.reels, fotos: pkg.fotos } : undefined
      );
      return {
        client,
        color: colorMap.get(client.id) ?? "#60a5fa",
        packageLabel: pkg?.label ?? null,
        reels,
        fotos,
        posts: pautaProgress(pautaPosts, client.id, data.year, data.month, maxWeek),
        inRevision: pieces.filter((p) => p.client_id === client.id && p.status === "revision").length,
        payment: null,
      };
    });

    return {
      colorMap,
      clientNames,
      risk,
      cards,
      todayCount: queue.filter((r) => r.date === todayISO).length,
      lateCount: queue.filter((r) => r.date < todayISO).length,
      pendingPauta: unscheduledPauta(pautaPosts, data.year, data.month, maxWeek),
      pausedCount: data.clients.length - activeClients.length,
    };
  }, [data, todayISO, packages]);

  return (
    <PageShell profile={profile}>
      <div className="p-6 space-y-6 max-w-5xl">
        <PageHeader crumb="Soma › Community" title="Community" />
        <ErrorBanner message={error} onClose={() => setError(null)} />

        {!data || !view ? (
          !error && <div className="p-4 text-xs text-muted">Cargando resumen...</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <Stat label="Salen hoy" value={view.todayCount} />
              <Stat label="Atrasadas" value={view.lateCount} tone={view.lateCount > 0 ? "text-crimson" : undefined} />
              <Stat label="En riesgo" value={view.risk.length} tone={view.risk.length > 0 ? "text-crimson" : undefined} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <AtRiskPanel rows={view.risk} clientNames={view.clientNames} colorMap={view.colorMap} todayISO={todayISO} />
              <PautaPending groups={view.pendingPauta} clientNames={view.clientNames} colorMap={view.colorMap} />
            </div>

            <ClientCards cards={view.cards} pausedCount={view.pausedCount} showMoney={false} />
          </>
        )}
      </div>
    </PageShell>
  );
}
