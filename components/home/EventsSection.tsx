import { EVENT_TYPE_COLOR, type CalendarEvent, type EventType } from "@/lib/types";
import { RecapCard, formatDay } from "./RecapCard";

const TYPE_LABEL: Record<EventType, string> = {
  grabacion: "Grabaciones",
  cobertura: "Coberturas",
  junta: "Juntas",
  entrega: "Entregas",
  otro: "Otros",
};

export function EventList({ events }: { events: CalendarEvent[] }) {
  return (
    <ul className="space-y-1.5">
      {events.map((e) => (
        <li key={e.id} className="flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: EVENT_TYPE_COLOR[e.event_type] }}
          />
          <span className="w-24 shrink-0 text-muted">{formatDay(e.event_date)}</span>
          <span className="font-medium text-text">{e.title}</span>
          {e.client?.name && <span className="text-muted">· {e.client.name}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function EventsSection({ events }: { events: CalendarEvent[] }) {
  const types = (Object.keys(TYPE_LABEL) as EventType[]).filter((t) =>
    events.some((e) => e.event_type === t)
  );
  return (
    <RecapCard title="Agenda y actividad" count={events.length} empty="Sin eventos esta semana.">
      <div className="space-y-4">
        {types.map((t) => (
          <div key={t} className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase text-muted">{TYPE_LABEL[t]}</p>
            <EventList events={events.filter((e) => e.event_type === t)} />
          </div>
        ))}
      </div>
    </RecapCard>
  );
}
