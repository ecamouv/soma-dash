import type { ContentPiece } from "@/lib/types";
import { pieceDate, weekDays, type WeeklyRecap } from "@/lib/weekly";

const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function overduePieces(pieces: ContentPiece[], todayISO: string): ContentPiece[] {
  return pieces.filter((p) => {
    const d = pieceDate(p);
    return !!d && d < todayISO;
  });
}

export function weekDuePieces(recap: WeeklyRecap): ContentPiece[] {
  return recap.openPieces.filter((p) => {
    const d = pieceDate(p);
    return !!d && d >= recap.range.start && d <= recap.range.end;
  });
}

/** Frase que cambia según la carga de la semana, más tres cifras clave. */
export default function WeekHeadline({ recap, todayISO }: { recap: WeeklyRecap; todayISO: string }) {
  const recordings = recap.events.filter((e) => e.event_type === "grabacion").length;
  const meetings = recap.events.filter((e) => e.event_type === "junta").length;
  const due = weekDuePieces(recap).length;
  const overdue = overduePieces(recap.openPieces, todayISO).length;

  const days = weekDays(recap.range);
  const load = days.map(
    (d) =>
      recap.events.filter((e) => e.event_date.slice(0, 10) === d).length +
      weekDuePieces(recap).filter((p) => pieceDate(p) === d).length
  );
  const max = Math.max(...load);
  const busiest = max >= 3 ? DAY_NAMES[load.indexOf(max)] : null;

  const parts: string[] = [];
  if (recordings) parts.push(plural(recordings, "grabación", "grabaciones"));
  if (meetings) parts.push(plural(meetings, "junta", "juntas"));
  if (due) parts.push(plural(due, "pieza por entregar", "piezas por entregar"));

  let sentence: string;
  if (parts.length === 0 && overdue === 0) {
    sentence = "Semana despejada. No hay eventos ni entregas agendadas.";
  } else if (parts.length === 0) {
    sentence = "Sin eventos esta semana, pero hay piezas atrasadas por revisar.";
  } else {
    sentence = `${joinList(parts)}.`;
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    if (busiest) sentence += ` El día más cargado es el ${busiest}.`;
  }

  const stats = [
    { label: "Grabaciones", value: recordings, tone: "" },
    { label: "Por entregar", value: due, tone: "" },
    ...(overdue > 0 ? [{ label: "Atrasadas", value: overdue, tone: "text-crimson" }] : []),
  ];

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-xl font-semibold leading-snug font-display text-text">{sentence}</p>
      <div className="flex gap-8">
        {stats.map((s) => (
          <div key={s.label}>
            <p className={`text-3xl font-bold font-display tabular-nums ${s.tone || "text-text"}`}>
              {s.value}
            </p>
            <p className="text-[11px] text-muted">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
