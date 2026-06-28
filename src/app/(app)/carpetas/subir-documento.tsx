"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearDocumentoRapido } from "./actions";
import { generarUrlSubida, registrarDocumento } from "../expedientes/actions";

export function SubirDocumento({ tipoId }: { tipoId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setSubiendo(true);
    setError(null);
    const fallos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgreso(files.length > 1 ? `${i + 1}/${files.length}` : "");
      try {
        const nombre = file.name.replace(/\.[^.]+$/, "");
        const { id } = await crearDocumentoRapido(tipoId, nombre);
        const contentType = file.type || "application/octet-stream";
        const { url, key } = await generarUrlSubida(file.name, contentType);
        const res = await fetch(url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": contentType },
        });
        if (!res.ok) throw new Error(`R2 respondió ${res.status}`);
        await registrarDocumento({
          expedienteId: id,
          r2Key: key,
          nombreArchivo: file.name,
          mime: contentType,
          tamano: file.size,
          tipoSoporte: "principal",
        });
      } catch (err) {
        fallos.push(`${file.name}: ${err instanceof Error ? err.message : "error"}`);
      }
    }
    setSubiendo(false);
    setProgreso("");
    if (ref.current) ref.current.value = "";
    if (fallos.length) setError(`Fallaron ${fallos.length} de ${files.length}: ${fallos.join(" | ")}`);
    router.refresh();
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
        {subiendo ? `Subiendo ${progreso}…` : "Subir documento(s)"}
        <input
          ref={ref}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="hidden"
          onChange={onFiles}
          disabled={subiendo}
        />
      </label>
      <span className="text-xs text-neutral-400">Puedes elegir varios; cada archivo crea un documento.</span>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
