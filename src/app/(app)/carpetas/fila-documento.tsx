"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { guardarDocumento, eliminarFila } from "./actions";
import { eliminarDocumento } from "../expedientes/actions";
import { conReintentos } from "@/lib/reintentos";

type Soporte = { id: string; nombre: string };
type Opcion = { id: string; ruta: string };

export type DocFila = {
  id: string;
  nombre: string;
  tipoId: string;
  tieneCF: boolean;
  rotulo: string;
  ubicacion: string;
  soportes: Soporte[];
};

const inp = "w-full rounded border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900";
const td = "px-3 py-3 align-top";

export function FilaDocumento({
  doc,
  opciones,
  carpetaActual,
}: {
  doc: DocFila;
  opciones: Opcion[];
  carpetaActual: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState(doc.nombre);
  const [tipoId, setTipoId] = useState(doc.tipoId);
  const [aplica, setAplica] = useState(doc.tieneCF);
  const [rotulo, setRotulo] = useState(doc.rotulo);
  const [ubicacion, setUbicacion] = useState(doc.ubicacion);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [errSoporte, setErrSoporte] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [errGuardar, setErrGuardar] = useState<string | null>(null);

  const sucio =
    nombre !== doc.nombre ||
    tipoId !== doc.tipoId ||
    aplica !== doc.tieneCF ||
    rotulo !== doc.rotulo ||
    ubicacion !== doc.ubicacion;

  async function guardar() {
    setGuardando(true);
    setErrGuardar(null);
    try {
      const fd = new FormData();
      fd.set("id", doc.id);
      fd.set("nombre", nombre);
      fd.set("tipoId", tipoId);
      if (aplica) fd.set("tieneCarpetaFisica", "on");
      fd.set("rotulo", rotulo);
      fd.set("ubicacion", ubicacion);
      fd.set("carpetaActual", carpetaActual);
      await guardarDocumento(fd);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
      router.refresh();
    } catch (err) {
      setErrGuardar(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function onSoporte(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setSubiendo(true);
    setErrSoporte(null);
    const fallos: string[] = [];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("expedienteId", doc.id);
        fd.set("tipoSoporte", "otro");
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
    if (fileRef.current) fileRef.current.value = "";
    if (fallos.length) setErrSoporte(`Fallaron ${fallos.length}: ${fallos.join(" | ")}`);
    router.refresh();
  }

  async function quitarSoporte(idSoporte: string) {
    await eliminarDocumento(idSoporte);
    router.refresh();
  }

  async function borrar() {
    if (!confirm("¿Eliminar este documento y todos sus archivos? No se puede deshacer.")) return;
    await eliminarFila(doc.id, carpetaActual);
    router.refresh();
  }

  return (
    <tr className="border-t border-neutral-100 align-top">
      <td className={`${td} w-64`}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inp} />
      </td>
      <td className={`${td} w-56`}>
        <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={inp}>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.ruta}
            </option>
          ))}
        </select>
        {tipoId !== doc.tipoId && (
          <p className="mt-1 text-xs text-amber-600">Se moverá al guardar</p>
        )}
      </td>
      <td className={td}>
        <div className="flex flex-wrap items-center gap-1">
          {doc.soportes.map((s) => (
            <span
              key={s.id}
              className="inline-flex max-w-[140px] items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
              title={s.nombre}
            >
              <span className="truncate">{s.nombre}</span>
              <button onClick={() => quitarSoporte(s.id)} className="text-neutral-400 hover:text-red-600">
                ×
              </button>
            </span>
          ))}
          <label className="cursor-pointer rounded border border-dashed border-neutral-300 px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-50">
            {subiendo ? "…" : "+ Agregar"}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="application/pdf,image/*"
              className="hidden"
              onChange={onSoporte}
              disabled={subiendo}
            />
          </label>
        </div>
        {errSoporte && <p className="mt-1 text-xs text-red-600">{errSoporte}</p>}
      </td>
      <td className={`${td} w-48`}>
        <select
          value={aplica ? "si" : "no"}
          onChange={(e) => setAplica(e.target.value === "si")}
          className={inp}
        >
          <option value="no">No aplica</option>
          <option value="si">Aplica</option>
        </select>
        {aplica && (
          <div className="mt-1 space-y-1">
            <input
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              placeholder="Nombre / rótulo"
              className={inp}
            />
            <input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Ubicación"
              className={inp}
            />
          </div>
        )}
      </td>
      <td className={td}>
        <div className="flex items-center gap-2">
          <a
            href={`/expedientes/${doc.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
          >
            Ver
          </a>
          <a
            href={`/expedientes/${doc.id}/pdf?dl=1`}
            className="rounded-lg border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
          >
            Descargar
          </a>
        </div>
      </td>
      <td className={`${td} w-28`}>
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={guardar}
              disabled={guardando}
              className={`rounded-lg px-2 py-1 text-xs font-medium text-white disabled:opacity-40 ${sucio ? "bg-neutral-900 hover:bg-neutral-800" : "bg-neutral-400 hover:bg-neutral-500"}`}
            >
              {guardando ? "…" : "Guardar"}
            </button>
            <button onClick={borrar} className="text-xs text-red-600 hover:underline">
              Eliminar
            </button>
          </div>
          {guardado && <span className="text-xs text-emerald-600">✓ Guardado</span>}
          {errGuardar && <span className="text-xs text-red-600">{errGuardar}</span>}
        </div>
      </td>
    </tr>
  );
}
