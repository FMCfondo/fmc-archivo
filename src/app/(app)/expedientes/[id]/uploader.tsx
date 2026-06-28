"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { conReintentos } from "@/lib/reintentos";

type TipoSoporte =
  | "principal"
  | "factura"
  | "soporte_pago"
  | "registro_contable"
  | "comprobante_bancario"
  | "otro";

const TIPOS: [TipoSoporte, string][] = [
  ["principal", "Documento principal"],
  ["factura", "Factura"],
  ["soporte_pago", "Soporte de pago"],
  ["registro_contable", "Registro contable"],
  ["comprobante_bancario", "Comprobante bancario"],
  ["otro", "Otro"],
];

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
    const fallos: string[] = [];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("expedienteId", expedienteId);
        fd.set("tipoSoporte", tipo);
        await conReintentos(async () => {
          const r = await fetch("/api/subir", { method: "POST", body: fd });
          if (!r.ok) {
            throw new Error(r.status === 413 ? "archivo muy grande (máx ~4.5 MB)" : `servidor ${r.status}`);
          }
        });
      } catch (err) {
        fallos.push(`${file.name}: ${err instanceof Error ? err.message : "error"}`);
      }
    }
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
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
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
          accept="application/pdf,image/*"
          onChange={onChange}
          disabled={subiendo}
          className="text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-neutral-800"
        />
        {subiendo && <span className="text-sm text-neutral-500">Subiendo…</span>}
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        Solo PDF e imágenes. Elige el tipo de soporte antes de seleccionar.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
