import type { WeeklyRecap } from "@/lib/weekly";
import { RecapCard } from "./RecapCard";

export default function ProspectsSection({ recap }: { recap: WeeklyRecap }) {
  const total = recap.newProspects.length + recap.prospectActivity.length;
  return (
    <RecapCard title="Prospectos" count={total} empty="Sin movimiento de prospectos esta semana.">
      <div className="space-y-3">
        {recap.newProspects.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase text-muted">Nuevos</p>
            <ul className="space-y-1">
              {recap.newProspects.map((p) => (
                <li key={p.id} className="text-xs">
                  <span className="font-medium text-text">{p.name}</span>
                  {p.market && <span className="text-muted"> · {p.market}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {recap.prospectActivity.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase text-muted">Bitácora</p>
            <ul className="space-y-1">
              {recap.prospectActivity.map((a) => (
                <li key={a.id} className="text-xs">
                  <span className="font-medium text-text">{a.prospect?.name ?? "Prospecto"}</span>
                  <span className="text-muted"> · {a.note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </RecapCard>
  );
}
