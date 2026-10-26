"use client";

import { useState, useEffect } from "react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import WeekHeadline from "@/components/home/WeekHeadline";
import WeekCurve from "@/components/home/WeekCurve";
import PipelineBar from "@/components/home/PipelineBar";
import NextWeek from "@/components/home/NextWeek";
import { PageHeader, PageShell, SessionLoading } from "@/components/ui";
import { fetchWeeklyRecap, weekRange, type WeeklyRecap } from "@/lib/weekly";
import { useSession } from "@/lib/useSession";
import { iso } from "@/lib/utils";

export default function SomaHomePage() {
  const currentUser = useSession();
  const [weekOffset, setWeekOffset] = useState(0);
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [loadingRecap, setLoadingRecap] = useState(true);
  const [recapError, setRecapError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    setLoadingRecap(true);
    setRecapError(null);
    fetchWeeklyRecap(weekRange(weekOffset))
      .then((r) => !cancelled && setRecap(r))
      .catch((err) => {
        console.error("Error al cargar el resumen semanal:", err);
        if (!cancelled) setRecapError("No se pudo cargar el resumen semanal.");
      })
      .finally(() => !cancelled && setLoadingRecap(false));
    return () => {
      cancelled = true;
    };
  }, [currentUser, weekOffset]);

  if (!currentUser) return <SessionLoading />;

  const range = weekRange(weekOffset);
  const todayISO = iso(new Date());
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  return (
    <PageShell profile={currentUser}>
      <div className="p-6 space-y-6 max-w-5xl">
        <PageHeader crumb="Soma › Resumen semanal" title="Resumen semanal">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              aria-label="Semana anterior"
              className="rounded-md border border-line p-2 text-muted hover:text-text"
            >
              <LuChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-40 text-center text-xs font-semibold">
              {fmt(range.start)} - {fmt(range.end)}
              {weekOffset === 0 ? " (esta semana)" : ""}
            </span>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              aria-label="Semana siguiente"
              className="rounded-md border border-line p-2 text-muted hover:text-text"
            >
              <LuChevronRight className="h-4 w-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-muted hover:text-text"
              >
                Hoy
              </button>
            )}
          </div>
        </PageHeader>

        {recapError && <p className="text-xs text-red-500">{recapError}</p>}

        {loadingRecap || !recap ? (
          <div className="p-4 text-xs text-muted">Cargando resumen...</div>
        ) : (
          <>
            <WeekHeadline recap={recap} todayISO={todayISO} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <WeekCurve key={recap.range.start} recap={recap} todayISO={todayISO} />
              </div>
              <div className="lg:col-span-2">
                <PipelineBar pieces={recap.openPieces} todayISO={todayISO} />
              </div>
            </div>
            <NextWeek events={recap.upcoming} />
          </>
        )}
      </div>
    </PageShell>
  );
}
