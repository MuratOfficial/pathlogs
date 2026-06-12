"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

const registerSchema = z.object({
  name: z.string().min(2, "Имя — минимум 2 символа"),
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль — минимум 6 символов"),
});

export async function registerAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (exists) return { error: "Пользователь с таким email уже существует" };

  // Первый зарегистрированный пользователь становится администратором
  const usersCount = await prisma.user.count();
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      role: usersCount === 0 ? "ADMIN" : "DEVELOPER",
    },
  });

  await signIn("credentials", {
    email: normalizedEmail,
    password,
    redirectTo: "/dashboard",
  });
  return {};
}

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: String(formData.get("callbackUrl") || "/dashboard"),
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Неверный email или пароль" };
    }
    throw err; // redirect() внутри signIn бросает NEXT_REDIRECT — пробрасываем
  }
}

/** Вход через Google OAuth (кнопка видна только при настроенных AUTH_GOOGLE_*). */
export async function googleLoginAction(formData: FormData) {
  await signIn("google", {
    redirectTo: String(formData.get("callbackUrl") || "/dashboard"),
  });
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/login");
}
