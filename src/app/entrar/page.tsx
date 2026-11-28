import { Suspense } from "react";
import type { Metadata } from "next";
import { FormularioAcceso } from "@/components/acceso";

export const metadata: Metadata = { title: "Entrar" };

export default function Entrar() {
  return (
    <Suspense>
      <FormularioAcceso modo="entrar" />
    </Suspense>
  );
}
