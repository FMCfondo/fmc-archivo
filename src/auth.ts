import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { usuarios, usuariosEmpresas } from "@/db/schema";

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

        const user = (
          await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1)
        )[0];
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.nombre };
      },
    }),
  ],
  callbacks: {
    authorized: ({ auth }) => !!auth?.user,
    jwt: async ({ token, user }) => {
      if (user?.id) {
        token.uid = user.id;
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
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.empresaId = token.empresaId as string | undefined;
        session.user.rol = token.rol as string | undefined;
      }
      return session;
    },
  },
});
