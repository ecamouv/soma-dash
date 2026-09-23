import type { WeeklyRecap } from "@/lib/weekly";
import { RecapCard } from "./RecapCard";

export default function ShotClientsSection({ shot }: { shot: WeeklyRecap["shotClients"] }) {
  return (
    <RecapCard title="Clientes grabados" count={shot.length} empty="No hubo grabaciones esta semana.">
      <ul className="space-y-1.5">
        {shot.map(({ client, pieces }) => (
          <li key={client.id} className="flex items-center justify-between text-xs">
            <span className="font-medium text-text">{client.name}</span>
            <span className="text-muted">{pieces} {pieces === 1 ? "pieza" : "piezas"}</span>
          </li>
        ))}
      </ul>
    </RecapCard>
  );
}
