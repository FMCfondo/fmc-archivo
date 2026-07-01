import Link from "next/link";
import { requireEmpresaId } from "@/lib/session";
import { signOut } from "@/auth";
import { EmpresaSwitcher } from "@/components/empresa-switcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, empresaId, membresias } = await requireEmpresaId();
  const activa = membresias.find((m) => m.empresaId === empresaId);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/carpetas" className="font-semibold">
              Archivo FMC
            </Link>
            <nav className="flex items-center gap-4 text-sm text-neutral-600">
              <Link href="/carpetas" className="hover:text-neutral-900">
                Carpetas
              </Link>
              <Link href="/inicio" className="hover:text-neutral-900">
                Inicio
              </Link>
              <Link href="/expedientes" className="hover:text-neutral-900">
                Buscar
              </Link>
              <Link href="/catalogo" className="hover:text-neutral-900">
                Catálogo
              </Link>
              <Link href="/equipo" className="hover:text-neutral-900">
                Equipo
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {membresias.length > 1 ? (
              <EmpresaSwitcher membresias={membresias} actual={empresaId} />
            ) : (
              <span className="hidden text-neutral-500 sm:inline">{activa?.nombre}</span>
            )}
            <Link
              href="/cuenta"
              className="hidden text-neutral-600 hover:text-neutral-900 sm:inline"
            >
              {session.user.name ?? session.user.email}
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="rounded-lg border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-100">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
