import Image from "next/image";
import type { ReactNode } from "react";

/** Tarjeta centrada con el logo, para login y actualizar contraseña. */
export default function AuthCard({ children }: { children: ReactNode }) {
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
        {children}
      </div>
    </div>
  );
}
