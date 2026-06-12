"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signIn, signOut, requireUser } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

export async function updateProfileAction(
  _prev: { error?: string; success?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Имя — минимум 2 символа" };

  await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/profile");
  return { success: "Имя сохранено. В шапке обновится после следующего входа." };
}

export async function changePasswordAction(
  _prev: { error?: string; success?: string } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 6) return { error: "Новый пароль — минимум 6 символов" };
  if (next !== confirm) return { error: "Пароли не совпадают" };

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  // У OAuth-аккаунта пароля нет — он его устанавливает впервые
  if (dbUser.passwordHash) {
    const ok = await bcrypt.compare(current, dbUser.passwordHash);
    if (!ok) return { error: "Текущий пароль неверен" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });
  return { success: "Пароль обновлён" };
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/login");
}
