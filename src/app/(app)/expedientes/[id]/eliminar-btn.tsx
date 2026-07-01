"use client";

import { eliminarExpediente } from "../actions";

export function EliminarExpedienteBtn({ id }: { id: string }) {
  return (
    <form
      action={eliminarExpediente}
      onSubmit={(e) => {
        if (!confirm("Se eliminará este expediente y todos sus documentos. Un administrador podrá recuperarlo. ¿Continuar?")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
        Eliminar
      </button>
    </form>
  );
}
