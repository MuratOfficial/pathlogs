"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Priority, TaskStatus, TaskType } from "@prisma/client";

const taskSchema = z.object({
  title: z.string().min(2, "Название — минимум 2 символа"),
  description: z.string().optional(),
  projectId: z.string().min(1),
  parentId: z.string().optional(),
  type: z.enum(["FEATURE", "BUG", "REFACTOR", "ANALYTICS", "MANAGEMENT", "DESIGN", "DOCS", "RESEARCH"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  estimateHours: z.coerce.number().positive().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

function revalidateTask(projectId: string, taskId?: string) {
  revalidatePath(`/projects/${projectId}`);
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

export async function createTaskAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    projectId: formData.get("projectId"),
    parentId: formData.get("parentId") || undefined,
    type: formData.get("type"),
    priority: formData.get("priority"),
    estimateHours: formData.get("estimateHours") || undefined,
    startDate: formData.get("startDate") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    assigneeIds: formData.getAll("assigneeIds").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const d = parsed.data;

  const task = await prisma.task.create({
    data: {
      title: d.title,
      description: d.description,
      projectId: d.projectId,
      parentId: d.parentId || null,
      type: d.type as TaskType,
      priority: d.priority as Priority,
      estimateHours: d.estimateHours,
      startDate: d.startDate ? new Date(d.startDate) : null,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      creatorId: user.id,
      assignees: d.assigneeIds?.length
        ? { connect: d.assigneeIds.map((id) => ({ id })) }
        : undefined,
    },
  });

  revalidateTask(d.projectId, task.parentId ?? undefined);
  return {};
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus) {
  await requireUser();
  const current = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { projectId: true },
  });
  // Смена статуса переносит карточку в колонку этого статуса (если она есть)
  const statusColumn = await prisma.boardColumn.findFirst({
    where: { projectId: current.projectId, status },
    select: { id: true },
  });
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      columnId: statusColumn?.id ?? null,
      closedAt: status === "CLOSED" || status === "DONE" ? new Date() : null,
    },
  });
  revalidateTask(task.projectId, taskId);
}

export async function updateTaskFieldsAction(
  taskId: string,
  fields: {
    title?: string;
    description?: string | null;
    type?: TaskType;
    priority?: Priority;
    estimateHours?: number | null;
    startDate?: string | null;
    dueDate?: string | null;
    assigneeIds?: string[];
  }
) {
  await requireUser();
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(fields.title !== undefined ? { title: fields.title } : {}),
      ...(fields.description !== undefined ? { description: fields.description } : {}),
      ...(fields.type !== undefined ? { type: fields.type } : {}),
      ...(fields.priority !== undefined ? { priority: fields.priority } : {}),
      ...(fields.estimateHours !== undefined ? { estimateHours: fields.estimateHours } : {}),
      ...(fields.startDate !== undefined
        ? { startDate: fields.startDate ? new Date(fields.startDate) : null }
        : {}),
      ...(fields.dueDate !== undefined
        ? { dueDate: fields.dueDate ? new Date(fields.dueDate) : null }
        : {}),
      ...(fields.assigneeIds !== undefined
        ? { assignees: { set: fields.assigneeIds.map((id) => ({ id })) } }
        : {}),
    },
  });
  revalidateTask(task.projectId, taskId);
}

export async function deleteTaskAction(taskId: string) {
  await requireUser();
  const task = await prisma.task.delete({ where: { id: taskId } });
  revalidateTask(task.projectId);
}

export async function addTaskLinkAction(fromId: string, toId: string, type: "BLOCKS" | "RELATES" | "DUPLICATES") {
  await requireUser();
  if (fromId === toId) return;
  const from = await prisma.task.findUniqueOrThrow({ where: { id: fromId } });
  await prisma.taskLink.upsert({
    where: { fromId_toId_type: { fromId, toId, type } },
    update: {},
    create: { fromId, toId, type },
  });
  revalidateTask(from.projectId, fromId);
  revalidatePath(`/tasks/${toId}`);
}

export async function removeTaskLinkAction(linkId: string) {
  await requireUser();
  const link = await prisma.taskLink.delete({
    where: { id: linkId },
    include: { from: true },
  });
  revalidateTask(link.from.projectId, link.fromId);
  revalidatePath(`/tasks/${link.toId}`);
}

export async function addPatchLogAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!taskId || title.length < 2) return { error: "Заголовок — минимум 2 символа" };
  if (!content) return { error: "Описание реализации обязательно" };

  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  await prisma.patchLog.create({
    data: { taskId, authorId: user.id, title, content },
  });
  revalidateTask(task.projectId, taskId);
  return {};
}

export async function deletePatchLogAction(id: string) {
  const user = await requireUser();
  const log = await prisma.patchLog.findUniqueOrThrow({
    where: { id },
    include: { task: true },
  });
  if (log.authorId !== user.id && user.role !== "ADMIN") {
    throw new Error("Можно удалять только свои записи");
  }
  await prisma.patchLog.delete({ where: { id } });
  revalidateTask(log.task.projectId, log.taskId);
}

export async function addTimeEntryAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const hours = Number(formData.get("hours"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const date = String(formData.get("date") ?? "");
  if (!taskId || !Number.isFinite(hours) || hours <= 0) {
    return { error: "Укажите время больше нуля" };
  }

  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  await prisma.timeEntry.create({
    data: {
      taskId,
      userId: user.id,
      hours,
      note,
      date: date ? new Date(date) : new Date(),
    },
  });
  revalidateTask(task.projectId, taskId);
  return {};
}

export async function deleteTimeEntryAction(id: string) {
  const user = await requireUser();
  const entry = await prisma.timeEntry.findUniqueOrThrow({
    where: { id },
    include: { task: true },
  });
  if (entry.userId !== user.id && user.role !== "ADMIN") {
    throw new Error("Можно удалять только свои записи");
  }
  await prisma.timeEntry.delete({ where: { id } });
  revalidateTask(entry.task.projectId, entry.taskId);
}

export async function deleteAttachmentAction(id: string) {
  const user = await requireUser();
  const att = await prisma.attachment.findUniqueOrThrow({ where: { id } });
  if (att.uploadedById !== user.id && user.role !== "ADMIN") {
    throw new Error("Можно удалять только свои файлы");
  }
  await prisma.attachment.delete({ where: { id } });
  if (att.taskId) revalidatePath(`/tasks/${att.taskId}`);
}
