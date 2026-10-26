"use client";

import { useState, useEffect, useMemo } from "react";
import { isAdminRole, useEffectiveRole } from "@/lib/roleView";
import { fetchTeam, withoutDevs } from "@/lib/team";
import StatsBar from "@/components/StatsBar";
import CalendarView from "@/components/CalendarView";
import EventModal from "@/components/EventModal";
import EventPreviewModal from "@/components/EventPreviewModal";
import { ErrorBanner, PageHeader, PageShell, SessionLoading } from "@/components/ui";
import type { CalendarEvent, Client, ContentPiece, Profile } from "@/lib/types";
import {
  fetchClients,
  fetchEvents,
  saveEventToSupabase,
  deleteEventFromSupabase,
  sendInvitations,
} from "@/lib/events";
import { fetchContentPieces } from "@/lib/deliveries";
import { useSession } from "@/lib/useSession";
import { errText } from "@/lib/utils";

export default function DashboardPage() {
  const currentUser = useSession();
  const role = useEffectiveRole(currentUser?.role);
  const [teamProfiles, setTeamProfiles] = useState<Profile[]>([]);

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

  // Cargar datos del calendario. Los clientes pausados se filtran por completo:
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
    if (!currentUser) return;
    loadData();
    // Lista del equipo para el filtro de admin.
    fetchTeam()
      .then((team) => setTeamProfiles(withoutDevs(team)))
      .catch((err) => console.error("Error al cargar el equipo:", err));
  }, [currentUser]);

  // 3. Lógica de Filtrado de Eventos
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Filtro por Cliente
      if (selectedClientId !== "all" && event.client_id !== selectedClientId) {
        return false;
      }

      // Filtro por Productor / Integrante (Solo para Admin)
      if (isAdminRole(role) && selectedProducerId !== "all") {
        const isCreatedBy = event.created_by === selectedProducerId;
        const isMember = event.members?.some((m) => m.user_id === selectedProducerId);
        if (!isCreatedBy && !isMember) return false;
      }

      return true;
    });
  }, [events, selectedClientId, selectedProducerId, role]);

  if (!currentUser) return <SessionLoading />;

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
          `El evento se guardó, pero no se pudo sincronizar con Google Calendar: ${errText(inviteErr)}`
        );
      }
    } catch (err) {
      console.error("Error guardando evento:", err);
      setErrorMsg(`No se pudo guardar el evento: ${errText(err)}`);
      await loadData();
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    setErrorMsg(null);
    try {
      const { googleSyncError } = await deleteEventFromSupabase(eventId);
      if (googleSyncError) {
        setErrorMsg(`El evento se borró, pero no se pudo cancelar en Google Calendar: ${googleSyncError}`);
      }
    } catch (err) {
      console.error("Error al eliminar evento:", err);
      setErrorMsg(`No se pudo eliminar el evento: ${errText(err)}`);
    }
    await loadData();
  };

  return (
    <PageShell profile={currentUser}>
        <div className="p-6 space-y-6">
          <PageHeader crumb="Operación › Calendario" title="Calendario" />

          <ErrorBanner message={errorMsg} onClose={() => setErrorMsg(null)} />

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
              {isAdminRole(role) && (
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
    </PageShell>
  );
}