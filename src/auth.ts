import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { and, eq, gte, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { usuarios, usuariosEmpresas, intentosLogin } from "@/db/schema";

const VENTANA_MIN = 15;
const MAX_INTENTOS = 5;

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // Rate limiting: bloquea tras varios intentos fallidos recientes para este correo.
        const desde = new Date(Date.now() - VENTANA_MIN * 60 * 1000);
        const [{ n }] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(intentosLogin)
          .where(
            and(
              eq(intentosLogin.email, email),
              eq(intentosLogin.exitoso, false),
              gte(intentosLogin.creadoEn, desde),
            ),
          );
        if (n >= MAX_INTENTOS) {
          return null;
        }

        const user = (
          await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1)
        )[0];

        const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;

        await db.insert(intentosLogin).values({ email, exitoso: ok });

        if (!user || !ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.nombre,
          debeCambiarPassword: user.debeCambiarPassword,
        };
      },
    }),
  ],
  callbacks: {
    authorized: ({ auth }) => !!auth?.user,
    jwt: async ({ token, user, trigger }) => {
      if (user?.id) {
        token.uid = user.id;
        token.debeCambiarPassword = (user as { debeCambiarPassword?: boolean }).debeCambiarPassword ?? false;
        const membresia = (
          await db
            .select()
            .from(usuariosEmpresas)
            .where(eq(usuariosEmpresas.usuarioId, user.id))
            .limit(1)
        )[0];
        if (membresia) {
          token.empresaId = membresia.empresaId;
          token.rol = membresia.rol;
        }
      }
      // Al llamar update() desde el cliente (tras cambiar la clave), refresca el flag.
      if (trigger === "update" && token.uid) {
        const fresco = (
          await db
            .select({ debeCambiarPassword: usuarios.debeCambiarPassword })
            .from(usuarios)
            .where(eq(usuarios.id, token.uid as string))
            .limit(1)
        )[0];
        if (fresco) token.debeCambiarPassword = fresco.debeCambiarPassword;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.empresaId = token.empresaId as string | undefined;
        session.user.rol = token.rol as string | undefined;
        session.user.debeCambiarPassword = Boolean(token.debeCambiarPassword);
      }
      return session;
    },
  },
});
