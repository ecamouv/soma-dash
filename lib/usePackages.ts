"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PACKAGES, packageList, type PackageDef, type PackageMap } from "@/lib/packages";
import { fetchPackages } from "@/lib/packagesData";

/** Paquetes de la base. Mientras carga (o si la tabla no existe) devuelve los originales. */
export function usePackages(): { packages: PackageMap; list: PackageDef[]; available: boolean; reload: () => Promise<void> } {
  const [state, setState] = useState<{ packages: PackageMap; available: boolean }>({
    packages: DEFAULT_PACKAGES,
    available: false,
  });

  const reload = useCallback(async () => {
    try {
      setState(await fetchPackages());
    } catch (err) {
      console.error("Error al cargar paquetes:", err);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { packages: state.packages, list: packageList(state.packages), available: state.available, reload };
}
