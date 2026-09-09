import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import PublicCalendarView, { type PublicCalendarItem } from "@/components/PublicCalendarView";
import { pieceLabel } from "@/lib/types";

// Vista pública de solo lectura: se resuelve enteramente en el servidor (Server
// Component). El navegador del cliente nunca recibe credenciales de Supabase ni
// hace queries directas -- solo recibe el HTML/JSON ya armado y acotado a este
// cliente. Sin caché entre visitas: los datos deben reflejar el estado actual.
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RawEvent {
  title: string;
  event_type: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
}

interface RawPiece {
  code: string;
  display_name: string | null;
  due_date: string;
}

interface RawPayment {
  due_date: string;
  label: string | null;
}

async function getPublicCalendarData(token: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, paused")
    .eq("public_token", token)
    .maybeSingle();

  if (!client) return null;

  // Cliente pausado: el link sigue siendo válido, pero su contenido se congela
  // igual que en el dashboard interno -- no se muestra nada hasta que se reanude.
  if (client.paused) {
    return { clientName: client.name as string, paused: true, items: [] as PublicCalendarItem[] };
  }

  const [eventsRes, piecesRes, paymentsRes] = await Promise.all([
    supabase
      .from("events")
      .select("title, event_type, event_date, event_time, location")
      .eq("client_id", client.id)
      .in("event_type", ["grabacion", "junta"]),
    supabase
      .from("content_pieces")
      .select("code, display_name, due_date")
      .eq("client_id", client.id)
      .not("due_date", "is", null),
    supabase
      .from("client_payments")
      .select("due_date, label")
      .eq("client_id", client.id),
  ]);

  const items: PublicCalendarItem[] = [
    ...((eventsRes.data as RawEvent[]) ?? []).map((e) => ({
      date: e.event_date,
      type: e.event_type as "grabacion" | "junta",
      title: e.title,
      time: e.event_time,
      location: e.location,
    })),
    ...((piecesRes.data as RawPiece[]) ?? []).map((p) => ({
      date: p.due_date,
      type: "entrega" as const,
      title: `Entrega ${pieceLabel(p)}`,
    })),
    ...((paymentsRes.data as RawPayment[]) ?? []).map((pay) => ({
      date: pay.due_date,
      type: "pago" as const,
      title: pay.label || "Pago",
    })),
  ];

  return { clientName: client.name as string, paused: false, items };
}

export default async function PublicClientCalendarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPublicCalendarData(token);

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <header className="border-b border-[#E6E2DA] bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-5">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-sm">
            <Image src="/SOMA-Logo.jpeg" alt="SOMA" width={48} height={48} className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8680]">
              Calendario de contenido
            </p>
            <h1 className="text-xl font-bold text-[#2A2823]">
              {data ? data.clientName : "Enlace no disponible"}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        {!data ? (
          <div className="rounded-2xl border border-[#E6E2DA] bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-[#2A2823] font-medium">
              Este enlace no es válido o ya no está disponible.
            </p>
            <p className="mt-1 text-xs text-[#8A8680]">
              Si crees que esto es un error, contacta a tu contacto en SOMA para un nuevo enlace.
            </p>
          </div>
        ) : data.paused ? (
          <div className="rounded-2xl border border-[#E6E2DA] bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-[#2A2823] font-medium">
              No hay actividad programada por el momento.
            </p>
          </div>
        ) : (
          <PublicCalendarView items={data.items} />
        )}
      </main>

      <footer className="mx-auto max-w-4xl px-6 pb-8 text-center text-[11px] text-[#8A8680]">
        SOMA · Vista de solo lectura
      </footer>
    </div>
  );
}
