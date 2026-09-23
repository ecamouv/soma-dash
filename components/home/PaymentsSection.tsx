import type { WeeklyRecap } from "@/lib/weekly";
import { RecapCard, formatDay } from "./RecapCard";

export default function PaymentsSection({ payments }: { payments: WeeklyRecap["payments"] }) {
  return (
    <RecapCard title="Pagos de la semana" count={payments.length} empty="Sin pagos programados esta semana.">
      <ul className="space-y-1.5">
        {payments.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-muted">{formatDay(p.due_date)}</span>
            <span className="font-medium text-text">{p.client?.name ?? "Cliente"}</span>
            {p.label && <span className="text-muted">· {p.label}</span>}
            {p.amount != null && (
              <span className="ml-auto text-muted">
                {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(p.amount)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </RecapCard>
  );
}
