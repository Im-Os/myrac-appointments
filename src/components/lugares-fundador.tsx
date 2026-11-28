"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function LugaresFundador() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    supabase()
      .rpc("lugares_fundador")
      .then(({ data }) => typeof data === "number" && setN(data));
  }, []);
  if (n === null || n <= 0) return null;
  return (
    <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
      Precio fundador: los primeros 15 talleres conservan este precio para siempre · quedan {n}
    </p>
  );
}
