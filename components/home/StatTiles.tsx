import type { WeeklyRecap } from "@/lib/weekly";

export default function StatTiles({ recap }: { recap: WeeklyRecap }) {
  const count = (t: string) => recap.events.filter((e) => e.event_type === t).length;
  const tiles = [
    { label: "Grabaciones", value: count("grabacion") },
    { label: "Juntas", value: count("junta") },
    { label: "Videos publicados", value: recap.publishedPieces.filter((p) => p.type === "v").length },
    { label: "Clientes grabados", value: recap.shotClients.length },
    { label: "Prospectos nuevos", value: recap.newProspects.length },
    { label: "Pagos de la semana", value: recap.payments.length },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border border-line bg-panel p-4 shadow-sm">
          <p className="text-2xl font-bold font-display text-text">{t.value}</p>
          <p className="text-[11px] text-muted">{t.label}</p>
        </div>
      ))}
    </div>
  );
}
