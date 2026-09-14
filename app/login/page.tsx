"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LuEye, LuEyeClosed } from "react-icons/lu";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Flujo de "¿Olvidaste tu contraseña?": reemplaza el form de login por uno que
  // solo pide el correo y dispara el email de recuperación de Supabase -- nunca
  // lleva directo a /actualizar-contrasena, esa página solo funciona vía el link
  // que Supabase manda por correo.
  const [mode, setMode] = useState<"login" | "recover">("login");
  const [recoverySent, setRecoverySent] = useState(false);
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg("Credenciales inválidas. Verifica tu correo y contraseña.");
      setIsLoading(false);
      return;
    }

    if (data.user) {
      router.push("/");
      router.refresh();
    }
  };

  const handleSendRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingRecovery(true);
    setErrorMsg(null);

    // Supabase no distingue si el correo existe o no en la respuesta (evita
    // enumeración de usuarios), así que mostramos el mismo mensaje de éxito
    // salvo que el propio Supabase rechace el request (ej. formato inválido).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/actualizar-contrasena`,
    });

    setIsSendingRecovery(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setRecoverySent(true);
  };

  const backToLogin = () => {
    setMode("login");
    setRecoverySent(false);
    setErrorMsg(null);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink p-4">
      {/* Logo grande como backdrop. Difuminado a propósito: el archivo fuente es de
          baja resolución (377x377) y se ve pixelado si se muestra nítido a este tamaño. */}
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
        {/* Header con Imagen */}
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

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            {errorMsg && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@soma.mx"
                className="w-full rounded-xl bg-panel2 border border-line px-4 py-2.5 text-sm text-text focus:border-brand2 focus:outline-none transition"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-medium text-muted">Contraseña</label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setMode("recover");
                  }}
                  className="text-[11px] font-medium text-muted hover:text-brand2 transition focus:outline-none"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-panel2 border border-line pl-4 pr-11 py-2.5 text-sm text-text focus:border-brand2 focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-text transition focus:outline-none"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <LuEyeClosed className="h-4 w-4" />
                  ) : (
                    <LuEye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-to-r from-brand to-brand2 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50 mt-2"
            >
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </button>
          </form>
        ) : recoverySent ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300">
              Si <span className="font-semibold">{email}</span> tiene una cuenta, te enviamos un
              correo con un enlace para restablecer tu contraseña.
            </div>
            <button
              type="button"
              onClick={backToLogin}
              className="w-full rounded-xl border border-line py-2.5 text-sm font-semibold text-muted hover:text-text hover:border-brand2 transition"
            >
              Volver a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendRecovery} className="space-y-4">
            <p className="text-xs text-muted -mt-2">
              Escribe tu correo y te mandaremos un enlace para restablecer tu contraseña.
            </p>

            {errorMsg && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@soma.mx"
                className="w-full rounded-xl bg-panel2 border border-line px-4 py-2.5 text-sm text-text focus:border-brand2 focus:outline-none transition"
              />
            </div>

            <button
              type="submit"
              disabled={isSendingRecovery}
              className="w-full rounded-xl bg-gradient-to-r from-brand to-brand2 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50 mt-2"
            >
              {isSendingRecovery ? "Enviando..." : "Enviar enlace de recuperación"}
            </button>
            <button
              type="button"
              onClick={backToLogin}
              className="w-full text-center text-[11px] font-medium text-muted hover:text-text transition"
            >
              Volver a iniciar sesión
            </button>
          </form>
        )}
      </div>
    </div>
  );
}