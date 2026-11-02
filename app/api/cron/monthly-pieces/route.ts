import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { missingPieceRows } from "@/lib/monthlyPieces";
import { DEFAULT_PACKAGES, type PackageMap } from "@/lib/packages";

// Vercel Cron (ver vercel.json) llama esto el día 1 de cada mes con
// "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });

  const month = new Date().getUTCMonth() + 1;
  // shortcut: content_pieces no tiene año, así que "piezas de este mes" = mes + creadas
  // en los últimos 6 meses (excluye las del mismo mes del año pasado). Agregar columna year si esto falla.
  const since = new Date(Date.now() - 183 * 24 * 60 * 60 * 1000).toISOString();

  const [clientsRes, piecesRes, packagesRes] = await Promise.all([
    admin.from("clients").select("id, package, paused"),
    admin.from("content_pieces").select("client_id, code, type").eq("month", month).gte("created_at", since),
    admin.from("packages").select("value, label, reels, fotos, carruseles, pauta_posts_per_week"),
  ]);
  if (clientsRes.error || piecesRes.error) {
    return NextResponse.json({ error: (clientsRes.error ?? piecesRes.error)!.message }, { status: 500 });
  }

  // Sin la tabla de paquetes (migración sin aplicar) se usan los cinco originales.
  const packages: PackageMap = packagesRes.error
    ? DEFAULT_PACKAGES
    : Object.fromEntries(
        (packagesRes.data ?? []).map((r) => [
          r.value,
          { value: r.value, label: r.label, reels: r.reels, fotos: r.fotos, carruseles: r.carruseles, pautaPerWeek: r.pauta_posts_per_week },
        ])
      );

  const rows = missingPieceRows(clientsRes.data, piecesRes.data, month, packages);
  if (rows.length > 0) {
    const { error } = await admin.from("content_pieces").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ month, created: rows.length });
}
