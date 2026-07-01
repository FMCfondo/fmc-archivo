import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      empresaId?: string;
      rol?: string;
      debeCambiarPassword?: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    debeCambiarPassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    empresaId?: string;
    rol?: string;
    debeCambiarPassword?: boolean;
  }
}
