"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LuX } from "react-icons/lu";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import StatsBar from "@/components/StatsBar";
import CalendarView from "@/components/CalendarView";
import EventModal from "@/components/EventModal";
import EventPreviewModal from "@/components/EventPreviewModal";
import type { CalendarEvent, Client, ContentPiece, Profile } from "@/lib/types";
import {
  fetchClients,
  fetchEvents,
  saveEventToSupabase,
  deleteEventFromSupabase,
  sendInvitations,
} from "@/lib/events";
import { fetchContentPieces } from "@/lib/deliveries";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [teamProfiles, setTeamProfiles] = useState<Profile[]>([]);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [month, setMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contentPieces, setContentPieces] = useState<ContentPiece[]>([]);

  // Estados para Filtros
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
  const [selectedProducerId, setSelectedProducerId] = useState<string>("all");

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Validar sesión y obtener Perfil real desde public.profiles
  useEffect(() => {
    const checkUserAndLoadProfiles = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Consultar perfil del usuario en la tabla profiles
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (userProfile) {
        setCurrentUser(userProfile as Profile);
      } else {
        // Fallback en caso de que la tabla aún se esté poblando
        setCurrentUser({
          id: user.id,
          email: user.email || "",
          full_name: user.email?.split("@")[0] || "Usuario",
          role: "prod",
          initials: (user.email || "U").substring(0, 2).toUpperCase(),
        });
      }

      // Si es Admin, cargar lista completa del equipo para el filtro
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });

      if (profilesData) {
        setTeamProfiles(profilesData as Profile[]);
      }

      setLoadingAuth(false);
    };

    checkUserAndLoadProfiles();
  }, [router, supabase]);

  // 2. Cargar datos del calendario. Los clientes pausados se filtran por completo:
  // no aparecen en el selector ni sus eventos/piezas en el calendario.
  //
  // contentPieces se trae completo (todas las piezas de todos los clientes), no solo
  // las que ya están ligadas a un evento -- si no, las piezas individuales creadas a
  // mano en Entregas (sin evento todavía, o más allá de las 4 base de un paquete
  // grande) nunca aparecían como seleccionables en el picker de EventModal. Al
  // recargar (que ya pasa después de guardar un evento y al montar la página)
  // cualquier pieza nueva agregada desde Entregas queda visible aquí.
  const loadData = async () => {
    const [clientsData, eventsData, piecesData] = await Promise.all([
      fetchClients(),
      fetchEvents(),
      fetchContentPieces(),
    ]);
    const activeEvents = eventsData.filter((e) => !e.client?.paused);
    setClients(clientsData.filter((c) => !c.paused));
    setEvents(activeEvents);
    setContentPieces(piecesData.filter((p) => !p.client?.paused));
  };

  useEffect(() => {
    if (!loadingAuth) {
      loadData();
    }
  }, [loadingAuth]);

  // 3. Lógica de Filtrado de Eventos
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Filtro por Cliente
      if (selectedClientId !== "all" && event.client_id !== selectedClientId) {
        return false;
      }

      // Filtro por Productor / Integrante (Solo para Admin)
      if (currentUser?.role === "admin" && selectedProducerId !== "all") {
        const isCreatedBy = event.created_by === selectedProducerId;
        const isMember = event.members?.some((m) => m.user_id === selectedProducerId);
        if (!isCreatedBy && !isMember) return false;
      }

      return true;
    });
  }, [events, selectedClientId, selectedProducerId, currentUser?.role]);

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

  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setIsPreviewOpen(false);
    setIsEditOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(event.event_date);
    setIsPreviewOpen(true);
  };

  const handleOpenEditFromPreview = () => {
    setIsPreviewOpen(false);
    setIsEditOpen(true);
  };

  const handleSaveEvent = async (
    eventData: Partial<CalendarEvent>,
    selectedPieceCodes: string[],
    selectedMemberIds: string[] = []
  ) => {
    setErrorMsg(null);
    try {
      const event = await saveEventToSupabase(eventData, selectedPieceCodes, selectedMemberIds);
      await loadData();

      // Sincroniza el evento de Google Calendar en cada guardado (crea o actualiza
      // el mismo evento) -- un cambio de día/hora/lugar debe notificarse aunque los
      // miembros no hayan cambiado.
      try {
        await sendInvitations(event.id, selectedMemberIds);
      } catch (inviteErr) {
        console.error("Error sincronizando Google Calendar:", inviteErr);
        setErrorMsg(
          `El evento se guardó, pero no se pudo sincronizar con Google Calendar: ${
            inviteErr instanceof Error ? inviteErr.message : String(inviteErr)
          }`
        );
      }
    } catch (err) {
      console.error("Error guardando evento:", err);
      setErrorMsg(
        `No se pudo guardar el evento: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    setErrorMsg(null);
    const { googleSyncError } = await deleteEventFromSupabase(eventId);
    await loadData();
    if (googleSyncError) {
      setErrorMsg(
        `El evento se borró, pero no se pudo cancelar en Google Calendar: ${googleSyncError}`
      );
    }
  };

  return (
    <div className="flex h-screen text-text">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-y-auto bg-ink">
        <TopBar profile={currentUser} onLogout={handleLogout} />

        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <span className="text-xs text-muted">Operación › Calendario</span>
            <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-text to-muted bg-clip-text text-transparent">
              Calendario
            </h1>
          </div>

          {errorMsg && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              <span>{errorMsg}</span>
              <button
                onClick={() => setErrorMsg(null)}
                aria-label="Cerrar aviso"
                className="shrink-0 rounded-md p-1 -m-1 text-red-300 hover:bg-red-500/10 hover:text-red-100"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Barra de Filtros */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Filtros:
              </span>

              {/* Selector de Cliente (Todos los roles) */}
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="rounded-xl border border-line bg-panel2 px-3 py-1.5 text-xs text-text focus:border-brand2 focus:outline-none transition"
              >
                <option value="all">Todos los clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Selector de Productor / Usuario (Solo Administradores) */}
              {currentUser.role === "admin" && (
                <select
                  value={selectedProducerId}
                  onChange={(e) => setSelectedProducerId(e.target.value)}
                  className="rounded-xl border border-line bg-panel2 px-3 py-1.5 text-xs text-text focus:border-brand2 focus:outline-none transition"
                >
                  <option value="all">Todo el equipo</option>
                  {teamProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.email} ({p.role})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {(selectedClientId !== "all" || selectedProducerId !== "all") && (
              <button
                onClick={() => {
                  setSelectedClientId("all");
                  setSelectedProducerId("all");
                }}
                className="text-xs text-brand2 hover:underline font-medium"
              >
                Restablecer filtros
              </button>
            )}
          </div>
        </div>

        {/* StatsBar y CalendarView traen su propio margen horizontal (px-6/mx-6)
            pensado para ir pegados al borde -- se quedan fuera del contenedor
            "p-6" de arriba para no duplicar el espaciado. */}
        <StatsBar events={filteredEvents} />

        <CalendarView
          month={month}
          events={filteredEvents}
          onMonthChange={setMonth}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
        />
      </div>

      <EventPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        event={selectedEvent}
        onEdit={handleOpenEditFromPreview}
      />

      <EventModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        selectedDate={selectedDate}
        selectedEvent={selectedEvent}
        clients={clients}
        existingContentPieces={contentPieces}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}