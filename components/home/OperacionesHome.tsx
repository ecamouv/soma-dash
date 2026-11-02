"use client";

import { useEffect, useMemo, useState } from "react";
import ClientCards, { type ClientCardData } from "@/components/home/ops/ClientCards";
import MeetingsPanel from "@/components/home/ops/MeetingsPanel";
import PaymentsPanel, { OverdueBubble } from "@/components/home/ops/PaymentsPanel";
import RevisionPanel from "@/components/home/ops/RevisionPanel";
import { ErrorBanner, PageHeader, PageShell } from "@/components/ui";
import { buildClientColorMap } from "@/lib/clientColors";
import { buildLines, periodLabel, type BillLine } from "@/lib/billing";
import { setPeriodPaid } from "@/lib/billingData";
import { formatMXN, formatShort, monthProgress, pautaProgress, revisionGroups } from "@/lib/opsHome";
import { fetchOpsHome, type OpsHomeData } from "@/lib/opsHomeData";
import { usePackages } from "@/lib/usePackages";
import type { Profile } from "@/lib/types";
import { errText, iso, weeksInMonth } from "@/lib/utils";

function Stat({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: string }) {
  return (
    <div>
      <p className={`text-3xl font-bold font-display tabular-nums ${tone || "text-text"}`}>{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
      {sub && <p className={`text-[11px] tabular-nums ${tone || "text-muted"}`}>{sub}</p>}
    </div>
  );
}

/** Línea de cobro de la tarjeta del cliente. */
function paymentSummary(entry?: { current?: BillLine; overdue: BillLine[] }): { text: string; late: boolean } | null {
  if (!entry) return null;
  if (entry.overdue.length > 0) {
    const n = entry.overdue.length;
    return { text: `Debe ${n} ${n === 1 ? "mes" : "meses"} · desde ${periodLabel(entry.overdue[0].period)}`, late: true };
  }
  const cur = entry.current;
  if (!cur) return null;
  if (cur.paid) return { text: "Pagado este mes", late: false };
  return { text: `Paga el ${formatShort(cur.dueDate)}${cur.amount != null ? ` · ${formatMXN(cur.amount)}` : ""}`, late: false };
}

export default function OperacionesHome({ profile }: { profile: Profile }) {
  const todayISO = iso(new Date());
  const { packages } = usePackages();
  const [data, setData] = useState<OpsHomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOpsHome(todayISO)
      .then((d) => !cancelled && setData(d))
      .catch((err) => {
        console.error("Error al cargar la home de Operaciones:", err);
        if (!cancelled) setError("No se pudo cargar el resumen de operaciones.");
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
    const clientById = new Map(data.clients.map((c) => [c.id, c]));

    const pieces = data.pieces.filter((p) => active.has(p.client_id));
    const pautaPosts = data.pautaPosts.filter((p) => active.has(p.client_id));
    const meetings = data.meetings.filter((m) => m.client_id && active.has(m.client_id));

    const revision = revisionGroups(pieces);
    const { current, overdue } = buildLines({
      clients: activeClients,
      billings: data.billing.billings,
      records: data.billing.records,
      prices: data.billing.prices,
      todayISO,
    });
    const linesByClient = new Map<string, { current?: BillLine; overdue: BillLine[] }>();
    for (const l of current) linesByClient.set(l.clientId, { ...linesByClient.get(l.clientId), overdue: [], current: l });
    for (const l of overdue) {
      const entry = linesByClient.get(l.clientId) ?? { overdue: [] };
      entry.overdue.push(l);
      linesByClient.set(l.clientId, entry);
    }

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
        posts: pautaProgress(pautaPosts, client.id, data.year, data.month, weeksInMonth(data.year, data.month - 1)),
        inRevision: pieces.filter((p) => p.client_id === client.id && p.status === "revision").length,
        payment: paymentSummary(linesByClient.get(client.id)),
      };
    });

    return {
      colorMap,
      clientById,
      meetings,
      revision,
      current,
      overdue,
      overdueTotal: overdue.reduce((sum, l) => sum + (l.amount ?? 0), 0),
      cards,
      revisionTotal: revision.reduce((s, g) => s + g.pieces.length, 0),
      pausedCount: data.clients.length - activeClients.length,
    };
  }, [data, todayISO, packages]);

  const handleSetPaid = async (line: BillLine, paid: boolean) => {
    const apply = (value: boolean) =>
      setData((prev) => {
        if (!prev) return prev;
        const others = prev.billing.records.filter((r) => !(r.client_id === line.clientId && r.period === line.period));
        const records = value ? [...others, { client_id: line.clientId, period: line.period, amount: line.amount }] : others;
        return { ...prev, billing: { ...prev.billing, records } };
      });
    apply(paid);
    try {
      await setPeriodPaid(line.clientId, line.period, paid, line.amount);
    } catch (err) {
      apply(!paid);
      setError(`No se pudo guardar el pago: ${errText(err)}`);
    }
  };

  return (
    <PageShell profile={profile}>
      <div className="p-6 space-y-6 max-w-5xl">
        <PageHeader crumb="Soma › Operaciones" title="Operaciones" />
        <ErrorBanner message={error} onClose={() => setError(null)} />

        {!data || !view ? (
          !error && <div className="p-4 text-xs text-muted">Cargando resumen...</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <Stat label="En revisión" value={view.revisionTotal} />
              <Stat
                label="Clientes sin pagar"
                value={view.overdue.length}
                sub={view.overdueTotal > 0 ? formatMXN(view.overdueTotal) : undefined}
                tone={view.overdue.length > 0 ? "text-crimson" : undefined}
              />
            </div>

            <OverdueBubble lines={view.overdue} clientById={view.clientById} colorMap={view.colorMap} onSetPaid={handleSetPaid} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <RevisionPanel groups={view.revision} colorMap={view.colorMap} todayISO={todayISO} />
              </div>
              <div className="lg:col-span-2">
                <PaymentsPanel
                  lines={view.current}
                  available={data.billing.available}
                  clientById={view.clientById}
                  colorMap={view.colorMap}
                  todayISO={todayISO}
                  onSetPaid={handleSetPaid}
                />
              </div>
            </div>

            <ClientCards cards={view.cards} pausedCount={view.pausedCount} />
            <MeetingsPanel meetings={view.meetings} colorMap={view.colorMap} todayISO={todayISO} />
          </>
        )}
      </div>
    </PageShell>
  );
}
