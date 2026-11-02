import Link from "next/link";
import { LuArrowRight } from "react-icons/lu";
import ClientAvatar from "@/components/home/ops/ClientAvatar";
import type { PendingPautaGroup } from "@/lib/communityHome";

const FALLBACK_COLOR = "#94a3b8";

/** Posts de pauta del mes que todavía no tienen fecha, por cliente. */
export default function PautaPending({
  groups,
  clientNames,
  colorMap,
}: {
  groups: PendingPautaGroup[];
  clientNames: Map<string, string>;
  colorMap: Map<string, string>;
}) {
  const total = groups.reduce((s, g) => s + g.count, 0);
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-text">Pauta sin fecha</h2>
        <span className="text-[11px] text-muted">{total} {total === 1 ? "post" : "posts"} este mes</span>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-muted">Todos los posts de pauta del mes tienen fecha.</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => {
            const name = clientNames.get(g.clientId) ?? "Cliente";
            return (
              <li key={g.clientId} className="flex items-center gap-3 text-xs">
                <ClientAvatar name={name} color={colorMap.get(g.clientId) ?? FALLBACK_COLOR} size={26} />
                <span className="min-w-0 flex-1 truncate font-medium text-text">{name}</span>
                <span className="tabular-nums text-muted">
                  {g.count} {g.count === 1 ? "post" : "posts"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/publicaciones"
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-text"
      >
        Programar en Publicaciones <LuArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}
