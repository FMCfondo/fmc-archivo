"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { generarUrlSubida, registrarDocumento } from "../actions";

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
    try {
      for (const file of files) {
        const contentType = file.type || "application/octet-stream";
        const { url, key } = await generarUrlSubida(file.name, contentType);
        const res = await fetch(url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": contentType },
        });
        if (!res.ok) throw new Error("No se pudo subir el archivo al almacenamiento.");
        await registrarDocumento({
          expedienteId,
          r2Key: key,
          nombreArchivo: file.name,
          mime: contentType,
          tamano: file.size,
          tipoSoporte: tipo,
        });
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir el archivo.");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
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
        Solo PDF e imágenes (JPG, PNG). Elige el tipo de soporte antes de seleccionar el archivo.
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
