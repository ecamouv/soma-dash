import { createClient } from "@supabase/supabase-js";

// Cliente con service role: SOLO para rutas de servidor (app/api/*). Nunca importar
// desde componentes "use client". Requiere SUPABASE_SERVICE_ROLE_KEY en el entorno.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
