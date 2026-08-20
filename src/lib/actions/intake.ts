"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { canManageProject } from "@/lib/access";
import { ensureStatusColumn } from "@/lib/board";
import { notifyUsers } from "@/lib/notify";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/** Заявка снаружи: имя и контакт нужны, чтобы было кому ответить. */
const intakeSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(2, "Представьтесь, пожалуйста").max(80),
  contact: z.string().trim().min(3, "Оставьте почту или телефон для ответа").max(120),
  title: z.string().trim().min(5, "Опишите суть в одной строке").max(160),
  details: z.string().trim().max(4000).optional(),
  /** Ловушка для ботов: настоящий человек это поле не видит и не заполняет. */
  website: z.string().max(0).optional(),
});

/** Включает форму приёма заявок и выдаёт ссылку (повторный вызов её не меняет). */
export async function enableIntakeAction(projectId: string, columnId?: string | null) {
  const user = await requireUser();
  if (!(await canManageProject(projectId, user))) {
    throw new Error("Настраивать приём заявок может владелец или менеджер проекта");
  }
  const form = await prisma.intakeForm.upsert({
    where: { projectId },
    update: { active: true, columnId: columnId ?? null },
    create: { projectId, token: randomBytes(16).toString("hex"), columnId: columnId ?? null },
  });
  revalidatePath(`/projects/${projectId}`);
  return { token: form.token };
}

export async function disableIntakeAction(projectId: string) {
  const user = await requireUser();
  if (!(await canManageProject(projectId, user))) {
    throw new Error("Настраивать приём заявок может владелец или менеджер проекта");
  }
  await prisma.intakeForm.update({ where: { projectId }, data: { active: false } });
  revalidatePath(`/projects/${projectId}`);
}

/**
 * Приём заявки снаружи — единственное действие в приложении, доступное без
 * входа. Поэтому здесь: жёсткие ограничения длины, ловушка для ботов и
 * никакого доступа к данным проекта — форма только создаёт задачу.
 */
export async function submitIntakeAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const parsed = intakeSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    contact: formData.get("contact"),
    title: formData.get("title"),
    details: formData.get("details") || undefined,
    website: formData.get("website") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Проверьте поля формы" };
  }
  const { token, name, contact, title, details } = parsed.data;

  const form = await prisma.intakeForm.findFirst({
    where: { token, active: true },
    select: {
      projectId: true,
      columnId: true,
      project: { select: { ownerId: true, members: { select: { userId: true } } } },
    },
  });
  if (!form) return { error: "Форма недоступна — возможно, приём заявок закрыт" };

  // Задачу создаём от имени владельца: у заявителя нет учётной записи,
  // а creator у задачи обязателен
  const creatorId = form.project.ownerId;
  const columnId = form.columnId ?? (await ensureStatusColumn(form.projectId, "TODO"));

  const description = [
    `**Заявка от:** ${name}`,
    `**Контакт:** ${contact}`,
    "",
    details ?? "",
  ].join("\n");

  const task = await prisma.task.create({
    data: {
      title,
      description,
      projectId: form.projectId,
      creatorId,
      columnId,
      status: "TODO",
      type: "RESEARCH",
      priority: "MEDIUM",
    },
    select: { id: true, number: true, project: { select: { key: true } } },
  });

  await notifyUsers(
    [form.project.ownerId, ...form.project.members.map((m) => m.userId)],
    // Автора-инициатора нет, поэтому исключать некого — служебный идентификатор
    "intake",
    task.id,
    "ASSIGNED",
    `Новая заявка ${task.project.key}-${task.number}: «${title}» (от ${name})`
  );

  revalidatePath(`/projects/${form.projectId}`);
  return { ok: true };
}
