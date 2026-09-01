"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { canManageProject, getUserCompanyId, isManager, type SessionUser } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const companySchema = z.object({
  name: z.string().trim().min(2, "Название — минимум 2 символа").max(80),
});

/** Компаниями распоряжаются админы и менеджеры (глобальная роль). */
async function requireCompanyManager(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isManager(user)) {
    throw new Error("Управлять компаниями могут администраторы и менеджеры");
  }
  return user;
}

/**
 * Менеджер распоряжается только своей компанией, админ — любой.
 * Без этого менеджер одной компании перекраивал бы состав чужой.
 */
async function requireOwnCompany(user: SessionUser, companyId: string) {
  if (user.role === "ADMIN") return;
  const mine = await getUserCompanyId(user.id);
  if (mine !== companyId) throw new Error("Это чужая компания");
}

function revalidateCompanies() {
  revalidatePath("/admin/companies");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function createCompanyAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const user = await requireCompanyManager();
  const parsed = companySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { name } = parsed.data;

  const exists = await prisma.company.findUnique({ where: { name }, select: { id: true } });
  if (exists) return { error: `Компания «${name}» уже есть` };

  const company = await prisma.company.create({ data: { name } });
  // Менеджер без компании сразу становится её сотрудником: иначе он создал бы
  // компанию и тут же потерял право ею управлять.
  if (user.role !== "ADMIN" && (await getUserCompanyId(user.id)) === null) {
    await prisma.user.update({
      where: { id: user.id },
      data: { companyId: company.id },
    });
  }
  revalidateCompanies();
  return {};
}

export async function renameCompanyAction(
  companyId: string,
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireCompanyManager();
  await requireOwnCompany(user, companyId);
  const parsed = companySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { name } = parsed.data;

  const clash = await prisma.company.findUnique({ where: { name }, select: { id: true } });
  if (clash && clash.id !== companyId) return { error: `Компания «${name}» уже есть` };

  await prisma.company.update({ where: { id: companyId }, data: { name } });
  revalidateCompanies();
  return { ok: true };
}

/**
 * Удаление компании. Сотрудники и проекты не пропадают — у них просто
 * обнуляется компания (onDelete: SetNull), и проекты снова видны по участию.
 * Поэтому удалять может только админ.
 */
export async function deleteCompanyAction(companyId: string) {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Удалять компании может только администратор");
  await prisma.company.delete({ where: { id: companyId } });
  revalidateCompanies();
}

/**
 * Переводит сотрудника в компанию (или убирает из компании при companyId = null).
 * Один пользователь — не более одной компании, поэтому это именно перевод.
 */
export async function setUserCompanyAction(userId: string, companyId: string | null) {
  const user = await requireCompanyManager();
  if (user.id === userId && user.role !== "ADMIN") {
    throw new Error("Свою компанию менять нельзя — попросите администратора");
  }

  const target = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { companyId: true },
  });
  // Менеджеру доступны только переводы в свою компанию и из неё
  if (companyId) await requireOwnCompany(user, companyId);
  if (target.companyId) await requireOwnCompany(user, target.companyId);

  await prisma.user.update({ where: { id: userId }, data: { companyId } });
  revalidateCompanies();
}

/**
 * Привязывает проект к компании (null — снимает привязку).
 * Нужно в первую очередь для проектов, созданных до разделения по компаниям.
 */
export async function setProjectCompanyAction(projectId: string, companyId: string | null) {
  const user = await requireCompanyManager();
  if (user.role !== "ADMIN") {
    if (!(await canManageProject(projectId, user))) {
      throw new Error("Требуются права менеджера проекта");
    }
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { companyId: true },
    });
    if (companyId) await requireOwnCompany(user, companyId);
    if (project.companyId) await requireOwnCompany(user, project.companyId);
  }

  await prisma.project.update({ where: { id: projectId }, data: { companyId } });
  revalidateCompanies();
  revalidatePath(`/projects/${projectId}`);
}
