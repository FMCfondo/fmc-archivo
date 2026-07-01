"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerUrlDescarga, eliminarDocumento } from "../actions";
import { ETIQUETAS_SOPORTE, formatTamano } from "@/lib/format";

/** Fila de un soporte/archivo (tabla `documentos`) dentro del detalle de un expediente. */
export function FilaSoporte({
  doc,
}: {
  doc: { id: string; nombreArchivo: string; tipoSoporte: string; tamano: number | null };
}) {
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);

  async function abrir() {
    setTrabajando(true);
    try {
      const url = await obtenerUrlDescarga(doc.id);
      window.open(url, "_blank");
    } finally {
      setTrabajando(false);
    }
  }

  async function borrar() {
    if (!confirm("Se eliminará este soporte. Un administrador podrá recuperarlo. ¿Continuar?")) return;
    setTrabajando(true);
    try {
      await eliminarDocumento(doc.id);
      router.refresh();
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-800">{doc.nombreArchivo}</p>
        <p className="text-xs text-neutral-400">
          {ETIQUETAS_SOPORTE[doc.tipoSoporte] ?? doc.tipoSoporte} · {formatTamano(doc.tamano)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={abrir}
          disabled={trabajando}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          Abrir
        </button>
        <button
          onClick={borrar}
          disabled={trabajando}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
