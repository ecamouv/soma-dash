import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["prod", "admin", "community", "editor"];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.trim().slice(0, 2);
  return letters.toUpperCase();
}

// Agrega un integrante al equipo: invita al correo (crea el usuario en Supabase Auth
// y envía el link para definir su contraseña) y crea/actualiza su fila en public.profiles.
// Solo puede usarlo un usuario con role "admin".
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Solo un administrador puede agregar integrantes." }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Agrégala a las variables de entorno." },
      { status: 500 }
    );
  }

  const body = (await request.json()) as { fullName?: string; email?: string; role?: UserRole };
  const fullName = body.fullName?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = body.role;

  if (!fullName || !email || !role || !ROLES.includes(role)) {
    return NextResponse.json({ error: "Nombre, correo y puesto son obligatorios." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${origin}/actualizar-contrasena`,
  });
  if (inviteError || !invited?.user) {
    return NextResponse.json(
      { error: inviteError?.message ?? "No se pudo invitar al usuario." },
      { status: 400 }
    );
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: invited.user.id,
    email,
    full_name: fullName,
    role,
    initials: initialsOf(fullName),
  });
  if (profileError) {
    return NextResponse.json(
      { error: `Se envió la invitación pero falló el perfil: ${profileError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

// Elimina por completo a un integrante: su fila en public.profiles y su usuario en
// Supabase Auth. Solo administradores, y nunca a sí mismo.
// Regla del proyecto: esta ruta NO modifica content_pieces ni clients. Si el integrante
// es editor de alguna pieza, se rechaza el borrado en vez de dejar que una FK ponga
// editor_id en null o borre piezas.
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Solo un administrador puede eliminar integrantes." }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Agrégala a las variables de entorno." },
      { status: 500 }
    );
  }

  const { userId } = (await request.json()) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "Falta el integrante." }, { status: 400 });
  if (userId === user.id) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo." }, { status: 400 });
  }

  // Solo lectura: ¿tiene piezas asignadas?
  const { count, error: countError } = await admin
    .from("content_pieces")
    .select("id", { count: "exact", head: true })
    .eq("editor_id", userId);
  if (countError) {
    return NextResponse.json({ error: `No se pudo verificar sus piezas: ${countError.message}` }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `Este integrante es editor de ${count} ${count === 1 ? "pieza" : "piezas"}. No se puede eliminar sin reasignarlas, y eso requiere tu autorización explícita porque modifica content_pieces.`,
      },
      { status: 409 }
    );
  }

  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
  if (profileError) {
    return NextResponse.json(
      { error: `No se pudo eliminar su perfil: ${profileError.message}` },
      { status: 409 }
    );
  }

  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError && !/not found/i.test(authError.message)) {
    return NextResponse.json(
      { error: `Se eliminó su perfil pero falló su usuario de acceso: ${authError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
