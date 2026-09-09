import type { Profile } from "@/lib/types";

interface TopBarProps {
  profile: Profile;
  onLogout?: () => void; // 👈 Agrega esta línea
}

export default function TopBar({ profile, onLogout }: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-line bg-panel px-6 py-4">
      {/* Tu contenido del TopBar ... */}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand2/20 text-brand2 font-bold text-xs">
            {profile.initials}
          </div>
          <span className="text-sm font-medium text-text">
            {profile.full_name}
          </span>
        </div>

        {/* Botón opcional para cerrar sesión */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="rounded-lg border border-line bg-panel2 px-3 py-1.5 text-xs text-muted hover:text-text hover:border-brand2 transition"
          >
            Cerrar Sesión
          </button>
        )}
      </div>
    </header>
  );
}