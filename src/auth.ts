import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
    };
  }
}

/** Google OAuth включается, если заданы AUTH_GOOGLE_ID и AUTH_GOOGLE_SECRET. */
export const googleAuthEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // passwordHash == null — аккаунт создан через Google, вход только по OAuth
        if (!user || !user.active || !user.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    ...(googleAuthEnabled ? [Google] : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      const email = user.email?.toLowerCase().trim();
      if (!email) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return existing.active; // деактивированных не пускаем

      // Первый пользователь в системе становится администратором (как и при регистрации)
      const usersCount = await prisma.user.count();
      await prisma.user.create({
        data: {
          email,
          name: user.name?.trim() || email.split("@")[0]!,
          role: usersCount === 0 ? "ADMIN" : "DEVELOPER",
        },
      });
      return true;
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === "google") {
        // У Google свой id — берём наш из БД (пользователь создан в signIn)
        const dbUser = await prisma.user.findUnique({
          where: { email: String(user.email).toLowerCase().trim() },
          select: { id: true, name: true, role: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.name = dbUser.name;
          token.role = dbUser.role;
        }
      } else if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});

/** Возвращает текущего пользователя или бросает ошибку (для server actions). */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Не авторизован");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Требуются права администратора");
  return user;
}
