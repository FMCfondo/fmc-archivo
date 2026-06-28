"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { conReintentos } from "@/lib/reintentos";

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
        const fd = new FormData();
        fd.set("file", file);
        fd.set("tipoId", tipoId);
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
      {error && <span className="max-w-md text-right text-xs text-red-600">{error}</span>}
    </div>
  );
}
