import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface UserAuth {
  supabase: SupabaseClient;
  user: User;
}

/** Para rutas API: usuario con sesión, o la respuesta 401 lista para devolver. */
export async function requireUser(): Promise<UserAuth | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return { supabase, user };
}

/** Usuario admin/dev más el cliente service role, o la respuesta de error. `action` va en el 403. */
export async function requireAdmin(
  action: string
): Promise<(UserAuth & { admin: SupabaseClient }) | NextResponse> {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { data: me } = await auth.supabase.from("profiles").select("role").eq("id", auth.user.id).single();
  if (me?.role !== "admin" && me?.role !== "dev") {
    return NextResponse.json({ error: `Solo un administrador puede ${action}.` }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Agrégala a las variables de entorno." },
      { status: 500 }
    );
  }
  return { ...auth, admin };
}
