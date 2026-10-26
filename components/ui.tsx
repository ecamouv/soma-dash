"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LuX } from "react-icons/lu";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { addMonths } from "@/lib/utils";

export function SessionLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-ink text-muted font-mono text-sm">
      Cargando sesión...
    </div>
  );
}

/** Marco de toda página con sesión: sidebar, barra superior con logout y columna con scroll. */
export function PageShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const router = useRouter();
  const logout = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };
  return (
    <div className="flex h-screen text-text">
      <Sidebar role={profile.role} />
      <div className="flex flex-1 flex-col overflow-y-auto bg-ink">
        <TopBar profile={profile} onLogout={logout} />
        {children}
      </div>
    </div>
  );
}

/** Migas + título con degradado; `children` va a la derecha (botones). */
export function PageHeader({
  crumb,
  title,
  children,
  className = "flex flex-wrap items-end justify-between gap-3",
}: {
  crumb: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  // Sin acciones va en un div de bloque: el degradado del título ocupa todo el ancho.
  return (
    <div className={children ? className : undefined}>
      <div>
        <span className="text-xs text-muted">{crumb}</span>
        <h1 className="flex items-center gap-2 text-2xl font-bold font-display bg-gradient-to-r from-text to-muted bg-clip-text text-transparent">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}

export function ErrorBanner({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
      <span>{message}</span>
      <button
        onClick={onClose}
        aria-label="Cerrar aviso"
        className="shrink-0 rounded-md p-1 -m-1 text-red-300 hover:bg-red-500/10 hover:text-red-100"
      >
        <LuX className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Botones Hoy / ‹ / › (siempre al día 1 del mes) y, opcional, la etiqueta "Mes Año". */
export function MonthNav({
  month,
  onChange,
  label,
  children,
}: {
  month: Date;
  onChange: (month: Date) => void;
  label?: string;
  children?: ReactNode;
}) {
  const btn = "rounded-md border border-line py-1.5 text-muted hover:text-text hover:bg-panel2";
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onChange(addMonths(new Date(), 0))} className={`${btn} px-3 text-xs`}>
        Hoy
      </button>
      <button onClick={() => onChange(addMonths(month, -1))} aria-label="Mes anterior" className={`${btn} px-2.5 text-sm`}>
        ‹
      </button>
      <button onClick={() => onChange(addMonths(month, 1))} aria-label="Mes siguiente" className={`${btn} px-2.5 text-sm`}>
        ›
      </button>
      {label && <span className="ml-2 font-display text-sm font-semibold text-text">{label}</span>}
      {children}
    </div>
  );
}

/** Ventana modal: fondo oscuro, tarjeta y fila de título con botón de cerrar. */
export function Modal({
  title,
  onClose,
  className = "max-w-sm rounded-2xl border-line",
  headerClassName = "mb-5 flex items-center justify-between",
  children,
}: {
  title: ReactNode;
  onClose: () => void;
  className?: string;
  headerClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className={`w-full border bg-panel p-6 shadow-2xl text-text ${className}`}>
        <div className={headerClassName}>
          {typeof title === "string" ? <h2 className="text-lg font-bold font-display text-text">{title}</h2> : title}
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 -m-1 text-muted hover:bg-panel2 hover:text-text"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Fila "ETIQUETA ..... valor" de los modales de detalle; `stacked` pone el valor debajo. */
export function InfoRow({ label, stacked, children }: { label: string; stacked?: boolean; children: ReactNode }) {
  const labelCls = "text-xs font-bold uppercase tracking-wider text-muted";
  return stacked ? (
    <div className="rounded-xl bg-panel2/60 px-4 py-3 border border-line/40 space-y-1.5">
      <span className={`block ${labelCls}`}>{label}</span>
      {children}
    </div>
  ) : (
    <div className="flex items-center justify-between rounded-xl bg-panel2/60 px-4 py-3 border border-line/40">
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  );
}
