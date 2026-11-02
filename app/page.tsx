"use client";

import CommunityHome from "@/components/home/CommunityHome";
import OperacionesHome from "@/components/home/OperacionesHome";
import ProductorHome from "@/components/home/ProductorHome";
import { SessionLoading } from "@/components/ui";
import { useEffectiveRole } from "@/lib/roleView";
import { useSession } from "@/lib/useSession";

// La home cambia según el rol con el que se ve la interfaz (el real, o el de "Ver como" en dev).
// Los roles sin home propia siguen viendo la de Productor.
export default function SomaHomePage() {
  const currentUser = useSession();
  const role = useEffectiveRole(currentUser?.role);

  if (!currentUser) return <SessionLoading />;
  if (role === "community") return <CommunityHome profile={currentUser} />;
  if (role === "operaciones") return <OperacionesHome profile={currentUser} />;
  return <ProductorHome currentUser={currentUser} />;
}
