import { Suspense } from "react";
import type { Metadata } from "next";
import { FormularioAcceso } from "@/components/acceso";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function Registro() {
  return (
    <Suspense>
      <FormularioAcceso modo="registro" />
    </Suspense>
  );
}
