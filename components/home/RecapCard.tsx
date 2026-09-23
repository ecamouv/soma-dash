import type { ReactNode } from "react";

export function RecapCard({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count?: number;
  empty: string;
  children?: ReactNode;
}) {
  const isEmpty = count === 0;
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
      <div className="h-1 bg-gradient-to-r from-brand to-brand2" />
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-text">{title}</h2>
          {count != null && <span className="text-[11px] text-muted">{count}</span>}
        </div>
        {isEmpty ? <p className="text-xs italic text-muted">{empty}</p> : children}
      </div>
    </section>
  );
}

export function formatDay(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
