"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { UserRole } from "@/lib/types";

// Solo para usuarios con rol "dev": elige con qué rol se ve la interfaz. No cambia el
// rol guardado del usuario ni los permisos reales del servidor.
const STORAGE_KEY = "soma-view-as-role";
const VALID_ROLES: UserRole[] = ["dev", "admin", "prod", "community", "editor"];

interface RoleViewValue {
  viewAs: UserRole;
  setViewAs: (role: UserRole) => void;
}

const RoleViewContext = createContext<RoleViewValue>({ viewAs: "dev", setViewAs: () => undefined });

function readStored(): UserRole {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (VALID_ROLES as string[]).includes(raw)) return raw as UserRole;
  } catch {
    // sin acceso a localStorage: se queda en dev
  }
  return "dev";
}

export function RoleViewProvider({ children }: { children: ReactNode }) {
  const [viewAs, setViewAsState] = useState<UserRole>(() => (typeof window === "undefined" ? "dev" : readStored()));

  const setViewAs = useCallback((role: UserRole) => {
    setViewAsState(role);
    try {
      window.localStorage.setItem(STORAGE_KEY, role);
    } catch {
      // ignorar
    }
  }, []);

  return <RoleViewContext.Provider value={{ viewAs, setViewAs }}>{children}</RoleViewContext.Provider>;
}

export function useRoleView(): RoleViewValue {
  return useContext(RoleViewContext);
}

/** Rol con el que se debe pintar la interfaz: el real, salvo que sea dev y esté viendo como otro. */
export function useEffectiveRole(realRole?: UserRole): UserRole | undefined {
  const { viewAs } = useContext(RoleViewContext);
  return realRole === "dev" ? viewAs : realRole;
}

/** admin y dev comparten los permisos de administración. */
export function isAdminRole(role?: UserRole): boolean {
  return role === "admin" || role === "dev";
}
