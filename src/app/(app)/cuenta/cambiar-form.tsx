"use client";

import { useActionState } from "react";
import { cambiarPassword } from "./actions";

const input =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";

export function CambiarPasswordForm() {
  const [state, action, pending] = useActionState(cambiarPassword, undefined);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-neutral-500">Cambiar contraseña</h2>
      <div>
        <label className="mb-1 block text-sm text-neutral-700">Contraseña actual</label>
        <input name="actual" type="password" required className={input} />
      </div>
      <div>
        <label className="mb-1 block text-sm text-neutral-700">Nueva contraseña</label>
        <input name="nueva" type="password" required className={input} />
      </div>
      <div>
        <label className="mb-1 block text-sm text-neutral-700">Confirmar nueva contraseña</label>
        <input name="confirmar" type="password" required className={input} />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Contraseña actualizada correctamente.
        </p>
      )}

      <button
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
