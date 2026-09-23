"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import StatTiles from "@/components/home/StatTiles";
import EventsSection from "@/components/home/EventsSection";
import PublishedSection from "@/components/home/PublishedSection";
import ShotClientsSection from "@/components/home/ShotClientsSection";
import ProspectsSection from "@/components/home/ProspectsSection";
import PaymentsSection from "@/components/home/PaymentsSection";
import UpcomingSection from "@/components/home/UpcomingSection";
import type { Profile } from "@/lib/types";
import { fetchWeeklyRecap, weekRange, type WeeklyRecap } from "@/lib/weekly";
import { createClient } from "@/lib/supabase/client";

export default function SomaHomePage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [weekOffset, setWeekOffset] = useState(0);
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [loadingRecap, setLoadingRecap] = useState(true);
  const [recapError, setRecapError] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

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

  useEffect(() => {
    if (loadingAuth) return;
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
  }, [loadingAuth, weekOffset]);

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

  const range = weekRange(weekOffset);
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  return (
    <div className="flex h-screen text-text">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto bg-ink">
        <TopBar profile={currentUser} onLogout={handleLogout} />

        <div className="p-6 space-y-6 max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-xs text-muted">Soma › Resumen semanal</span>
              <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-text to-muted bg-clip-text text-transparent">
                Resumen semanal
              </h1>
            </div>
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
          </div>

          {recapError && <p className="text-xs text-red-500">{recapError}</p>}

          {loadingRecap || !recap ? (
            <div className="p-4 text-xs text-muted">Cargando resumen...</div>
          ) : (
            <>
              <StatTiles recap={recap} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <EventsSection events={recap.events} />
                <PublishedSection pieces={recap.publishedPieces} />
                <ShotClientsSection shot={recap.shotClients} />
                <ProspectsSection recap={recap} />
                <PaymentsSection payments={recap.payments} />
                <UpcomingSection events={recap.upcoming} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
