import { requireSession } from "@/lib/session";
import { CambiarPasswordForm } from "./cambiar-form";

export default async function CuentaPage() {
  const session = await requireSession();

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-lg font-semibold">Mi cuenta</h1>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 text-sm">
        <p className="text-neutral-500">Correo</p>
        <p className="text-neutral-800">{session.user.email}</p>
      </div>

      <CambiarPasswordForm />
    </div>
  );
}
