"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserRole } from "@/lib/types";
import { useStoredState } from "@/lib/useStoredState";

// Solo para usuarios con rol "dev": elige con qué rol se ve la interfaz. No cambia el
// rol guardado del usuario ni los permisos reales del servidor.
const VALID_ROLES: UserRole[] = ["dev", "admin", "prod", "community", "editor"];

interface RoleViewValue {
  viewAs: UserRole;
  setViewAs: (role: UserRole) => void;
}

const RoleViewContext = createContext<RoleViewValue>({ viewAs: "dev", setViewAs: () => undefined });

export function RoleViewProvider({ children }: { children: ReactNode }) {
  const [stored, setViewAs] = useStoredState<UserRole>("soma-view-as-role", "dev");
  const viewAs = VALID_ROLES.includes(stored) ? stored : "dev";
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
