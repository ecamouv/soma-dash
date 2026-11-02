"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Evento que lib/deliveries.ts dispara cuando una pieza se crea, cambia o se borra. */
export const PIECES_CHANGED_EVENT = "soma:pieces-changed";

const POLL_MS = 30_000;

/**
 * Cuántas piezas de clientes activos están en revisión. Sirve para la notificación del
 * sidebar: sube cuando una pieza llega a revisión y baja en cuanto sale (aprobada, de
 * vuelta a edición o borrada). Se actualiza al instante con los cambios hechos en esta
 * pestaña, al volver a la pestaña y cada 30 s para los de otros usuarios.
 */
export function useRevisionCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const supabase = createClient();

    const load = async () => {
      const { count: n, error } = await supabase
        .from("content_pieces")
        .select("id, client:clients!inner(paused)", { count: "exact", head: true })
        .eq("status", "revision")
        .eq("client.paused", false);
      if (error) console.error("Error al contar piezas en revisión:", error);
      else if (!cancelled) setCount(n ?? 0);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };

    load();
    const timer = setInterval(load, POLL_MS);
    window.addEventListener(PIECES_CHANGED_EVENT, load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener(PIECES_CHANGED_EVENT, load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  return count;
}
