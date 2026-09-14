"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LuTriangleAlert, LuLoaderCircle } from "react-icons/lu";
import { createClient } from "@/lib/supabase/client";
import PasswordChangeForm from "@/components/PasswordChangeForm";

type Status = "checking" | "ready" | "invalid";

/**
 * Página a la que apunta el link de recuperación que Supabase manda por correo
 * (ver supabase.auth.resetPasswordForEmail en /login). Solo funciona si se llega
 * con los parámetros de recovery que Supabase agrega al redirectTo -- si alguien
 * entra directo a esta URL sin ellos, se le pide solicitar un enlace nuevo en vez
 * de dejarlo cambiar la contraseña.
 */
export default function ActualizarContrasenaPage() {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);

    const errorDescription =
      hashParams.get("error_description") || queryParams.get("error_description");
    if (errorDescription) {
      setStatus("invalid");
      return;
    }

    const hasRecoveryParams =
      queryParams.has("code") ||
      hashParams.has("access_token") ||
      queryParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery";

    if (!hasRecoveryParams) {
      setStatus("invalid");
      return;
    }

    // Supabase detecta el código/token en la URL al inicializar el cliente y, si es
    // válido, emite este evento con la sesión temporal de recovery ya lista.
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });

    // Si el código ya expiró o es inválido, Supabase no emite el evento -- después
    // de un momento razonable para el intercambio de red, lo tratamos como inválido.
    const timeout = setTimeout(() => {
      setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 6000);

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [supabase]);

  const handleDone = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink p-4">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-60">
        <Image
          src="/SOMA-Logo.jpeg"
          alt=""
          width={900}
          height={900}
          className="h-[90vh] w-[90vh] max-w-none object-contain blur-2xl"
          priority
        />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-panel p-8 shadow-2xl">
        <div className="flex flex-col items-center justify-center mb-6">
          <Image
            src="/SOMA-Corner.png"
            alt="SOMA Logo"
            width={140}
            height={243}
            className="h-20 w-auto object-contain mb-2"
            priority
          />
        </div>

        {status === "checking" && (
          <div className="flex flex-col items-center gap-3 py-6 text-muted">
            <LuLoaderCircle className="h-5 w-5 animate-spin" />
            <p className="text-sm">Verificando enlace...</p>
          </div>
        )}

        {status === "invalid" && (
          <div className="space-y-4">
            <h1 className="text-center text-lg font-bold font-display text-text">
              Actualizar contraseña
            </h1>
            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
              <p className="text-xs text-red-300">
                Este enlace no es válido o ya expiró. Solicita un nuevo correo de recuperación
                desde la página de inicio de sesión.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="w-full rounded-xl bg-gradient-to-r from-brand to-brand2 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
            >
              Ir a iniciar sesión
            </button>
          </div>
        )}

        {status === "ready" && (
          <div className="space-y-4">
            <h1 className="text-center text-lg font-bold font-display text-text">
              Actualizar contraseña
            </h1>
            <p className="text-center text-xs text-muted -mt-2">
              Escribe tu nueva contraseña dos veces para confirmarla.
            </p>
            <PasswordChangeForm
              onCancel={() => router.push("/login")}
              cancelLabel="Cancelar"
              onDone={handleDone}
              doneLabel="Ir a iniciar sesión"
            />
          </div>
        )}
      </div>
    </div>
  );
}
