import { requireSession } from "@/lib/session";
import { CambiarPasswordForm } from "./cambiar-form";

export default async function CuentaPage() {
  const session = await requireSession();
  const forzado = Boolean(session.user.debeCambiarPassword);

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-lg font-semibold">Mi cuenta</h1>

      {forzado && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Por seguridad debes definir una nueva contraseña antes de continuar.
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-5 text-sm">
        <p className="text-neutral-500">Correo</p>
        <p className="text-neutral-800">{session.user.email}</p>
      </div>

      <CambiarPasswordForm forzado={forzado} />
    </div>
  );
}
