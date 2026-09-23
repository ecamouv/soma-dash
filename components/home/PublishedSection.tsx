import { pieceLabel, type ContentPiece } from "@/lib/types";
import { RecapCard, formatDay } from "./RecapCard";

export default function PublishedSection({ pieces }: { pieces: ContentPiece[] }) {
  return (
    <RecapCard title="Piezas publicadas" count={pieces.length} empty="Aún no hay piezas publicadas esta semana.">
      <ul className="space-y-1.5">
        {pieces.map((p) => (
          <li key={p.id} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 text-muted">{p.due_date ? formatDay(p.due_date) : "—"}</span>
            <span className="rounded-full border border-line bg-panel2 px-2 py-0.5 text-[10px] text-muted">
              {p.type === "v" ? "Video" : "Foto"}
            </span>
            <span className="font-medium text-text">{pieceLabel(p)}</span>
            {p.client?.name && <span className="text-muted">· {p.client.name}</span>}
            {p.editor?.full_name && <span className="text-muted">· {p.editor.full_name}</span>}
          </li>
        ))}
      </ul>
    </RecapCard>
  );
}
