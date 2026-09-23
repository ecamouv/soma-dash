"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LuCalendar, LuPackageCheck, LuCalendarCheck, LuUsers, LuSettings, LuAlbum, LuUsersRound } from "react-icons/lu";

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }> | null;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3 text-xs font-semibold transition ${
        isActive
          ? "bg-gradient-to-r from-brand2/20 via-brand2/5 to-transparent text-text"
          : "text-muted hover:bg-panel2/60 hover:text-text"
      }`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-brand to-brand2" />
      )}
      {Icon ? (
        <Icon className="h-4 w-4" />
      ) : (
        <Image
          src="/SOMA-Corner.png"
          alt=""
          width={16}
          height={16}
          className="h-4 w-4 object-contain"
        />
      )}
      <span>{label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Soma",
      href: "/",
      icon: null,
    },
    {
      label: "Calendario",
      href: "/calendario",
      icon: LuCalendar,
    },
    {
      label: "Entregas",
      href: "/entregas",
      icon: LuPackageCheck,
    },
    {
      label: "Publicaciones",
      href: "/publicaciones",
      icon: LuCalendarCheck,
    },
    {
      label: "Clientes",
      href: "/clientes",
      icon: LuUsers,
    },
        {
      label: "Accesos Web",
      href: "/accesos",
      icon: LuAlbum,
    },
    {
      label: "Equipo",
      href: "/equipo",
      icon: LuUsersRound,
    },
  ];

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-white/5 bg-panel/40 backdrop-blur-xl p-4 text-text">
      {/* Logo Branding */}
      <div className="mb-8 px-2 py-3">
        <Image
          src="/SOMA-Corner.png"
          alt="SOMA Agency"
          width={140}
          height={40}
          className="h-8 w-auto object-contain"
          priority
        />
      </div>

      {/* Menú de Navegación */}
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={pathname === item.href}
          />
        ))}
      </nav>

      {/* Configuración: fija hasta abajo, separada del resto del menú */}
      <div className="mt-auto pt-3 border-t border-white/5">
        <NavLink
          href="/configuracion"
          label="Configuración"
          icon={LuSettings}
          isActive={pathname === "/configuracion"}
        />
      </div>
    </aside>
  );
}