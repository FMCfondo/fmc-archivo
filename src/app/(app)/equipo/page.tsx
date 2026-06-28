import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usuarios, usuariosEmpresas } from "@/db/schema";
import { requireEmpresaId } from "@/lib/session";
import {
  crearEmpresa,
  agregarMiembro,
  cambiarRol,
  quitarMiembro,
  renombrarEmpresa,
} from "./actions";

const inp =
  "rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";
const ROLES = [
  ["admin", "Administrador"],
  ["editor", "Editor"],
  ["lector", "Lector"],
] as const;

export default async function EquipoPage() {
  const { session, empresaId, rol, membresias } = await requireEmpresaId();
  const esAdmin = rol === "admin";
  const activa = membresias.find((m) => m.empresaId === empresaId);

  const miembros = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nombre: usuarios.nombre,
      rol: usuariosEmpresas.rol,
    })
    .from(usuariosEmpresas)
    .innerJoin(usuarios, eq(usuariosEmpresas.usuarioId, usuarios.id))
    .where(eq(usuariosEmpresas.empresaId, empresaId))
    .orderBy(usuarios.nombre);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold">Equipo</h1>

      {/* Empresa activa */}
      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-500">Empresa activa</h2>
        {esAdmin ? (
          <form action={renombrarEmpresa} className="flex flex-wrap items-end gap-2">
            <div className="flex flex-1 flex-col">
              <label className="mb-1 text-xs text-neutral-500">Nombre</label>
              <input name="nombre" defaultValue={activa?.nombre} required className={`${inp} w-full`} />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs text-neutral-500">NIT</label>
              <input name="nit" className={inp} />
            </div>
            <button className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100">
              Guardar
            </button>
          </form>
        ) : (
          <p className="text-sm text-neutral-800">{activa?.nombre}</p>
        )}
      </section>

      {/* Miembros */}
      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-500">Miembros ({miembros.length})</h2>
        <div className="divide-y divide-neutral-100">
          {miembros.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-800">
                  {m.nombre}
                  {m.id === session.user.id && (
                    <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">
                      tú
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-400">{m.email}</p>
              </div>
              {esAdmin && m.id !== session.user.id ? (
                <div className="flex items-center gap-2">
                  <form action={cambiarRol} className="flex items-center gap-1">
                    <input type="hidden" name="usuarioId" value={m.id} />
                    <select name="rol" defaultValue={m.rol} className={inp}>
                      {ROLES.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <button className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100">
                      Guardar
                    </button>
                  </form>
                  <form action={quitarMiembro}>
                    <input type="hidden" name="usuarioId" value={m.id} />
                    <button className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                      Quitar
                    </button>
                  </form>
                </div>
              ) : (
                <span className="text-sm text-neutral-500">
                  {ROLES.find(([v]) => v === m.rol)?.[1] ?? m.rol}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Agregar miembro (solo admin) */}
      {esAdmin && (
        <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-500">Agregar miembro</h2>
          <form action={agregarMiembro} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input name="email" type="email" placeholder="Correo" required className={inp} />
            <input name="nombre" placeholder="Nombre" className={inp} />
            <select name="rol" defaultValue="editor" className={inp}>
              {ROLES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input
              name="password"
              type="text"
              placeholder="Contraseña temporal (si es nuevo)"
              className={inp}
            />
            <div className="sm:col-span-2">
              <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
                Agregar
              </button>
            </div>
          </form>
          <p className="text-xs text-neutral-400">
            Si el correo ya existe en el sistema, solo se agrega a esta empresa (no necesita
            contraseña).
          </p>
        </section>
      )}

      {/* Crear empresa */}
      <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-500">Crear otra empresa</h2>
        <form action={crearEmpresa} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-1 flex-col">
            <label className="mb-1 text-xs text-neutral-500">Nombre</label>
            <input name="nombre" required placeholder="Nueva empresa" className={`${inp} w-full`} />
          </div>
          <div className="flex flex-col">
            <label className="mb-1 text-xs text-neutral-500">NIT</label>
            <input name="nit" className={inp} />
          </div>
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">
            Crear
          </button>
        </form>
        <p className="text-xs text-neutral-400">
          Quedarás como administrador de la nueva empresa y se activará automáticamente.
        </p>
      </section>
    </div>
  );
}
