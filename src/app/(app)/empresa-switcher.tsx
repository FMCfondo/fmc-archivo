"use client";

import { cambiarEmpresa } from "./equipo/actions";
import type { Membresia } from "@/lib/session";

export function EmpresaSwitcher({
  membresias,
  actual,
}: {
  membresias: Membresia[];
  actual: string;
}) {
  return (
    <form action={cambiarEmpresa}>
      <select
        name="empresaId"
        defaultValue={actual}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
      >
        {membresias.map((m) => (
          <option key={m.empresaId} value={m.empresaId}>
            {m.nombre}
          </option>
        ))}
      </select>
    </form>
  );
}
