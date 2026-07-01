"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { subirArchivos } from "@/lib/subir-cliente";
import { ACCEPT_ARCHIVOS } from "@/lib/constantes";
import { ETIQUETAS_SOPORTE } from "@/lib/format";
import { INPUT_INLINE } from "@/components/ui";
import type { TipoSoporte } from "@/db/schema";

const TIPOS = Object.entries(ETIQUETAS_SOPORTE) as [TipoSoporte, string][];

export function Uploader({ expedienteId }: { expedienteId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<TipoSoporte>("principal");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setSubiendo(true);
    setError(null);
    const fallos = await subirArchivos(files, { expedienteId, tipoSoporte: tipo });
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";
    if (fallos.length) setError(`Fallaron ${fallos.length}: ${fallos.join(" | ")}`);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoSoporte)}
          disabled={subiendo}
          className={INPUT_INLINE}
        >
          {TIPOS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ARCHIVOS}
          onChange={onChange}
          disabled={subiendo}
          className="text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-800"
        />
        {subiendo && <span className="text-sm text-neutral-500">Subiendo…</span>}
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        Solo PDF e imágenes (JPG, PNG). Elige el tipo de soporte antes de seleccionar.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
