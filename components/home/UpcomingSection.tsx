import type { CalendarEvent } from "@/lib/types";
import { RecapCard } from "./RecapCard";
import { EventList } from "./EventsSection";

export default function UpcomingSection({ events }: { events: CalendarEvent[] }) {
  return (
    <RecapCard title="Próxima semana" count={events.length} empty="Nada agendado para la próxima semana.">
      <EventList events={events} />
    </RecapCard>
  );
}
