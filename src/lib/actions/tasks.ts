"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import {
  filterProjectMembers,
  isManager,
  requireProjectMember,
  requireTaskMember,
} from "@/lib/access";
import { notifyTaskWatchers, notifyUsers } from "@/lib/notify";
import { STATUS_LABELS } from "@/lib/labels";
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
  checklist: z.string().optional(),
});

/** «Пункт на строку» → массив непустых пунктов (маркеры -/* и [ ] отбрасываются). */
function parseChecklistLines(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*]?\s*(\[[ xX]?\]\s*)?/, "").trim())
    .filter(Boolean)
    .slice(0, 100);
}

function revalidateTask(projectId: string, taskId?: string) {
  revalidatePath(`/projects/${projectId}`);
  if (taskId) revalidatePath(`/tasks/${taskId}`);
}

export async function createTaskAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
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
    checklist: formData.get("checklist") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const d = parsed.data;
  const user = await requireProjectMember(d.projectId);

  if (d.parentId) {
    const parent = await prisma.task.findUnique({
      where: { id: d.parentId },
      select: { projectId: true },
    });
    if (parent?.projectId !== d.projectId) {
      return { error: "Родительская задача из другого проекта" };
    }
  }

  const assigneeIds = await filterProjectMembers(d.projectId, d.assigneeIds ?? []);

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
      assignees: assigneeIds.length
        ? { connect: assigneeIds.map((id) => ({ id })) }
        : undefined,
      checklist: {
        create: parseChecklistLines(d.checklist).map((text, i) => ({
          text,
          order: (i + 1) * 10,
        })),
      },
    },
    include: { project: { select: { key: true } } },
  });

  await notifyUsers(
    assigneeIds,
    user.id,
    task.id,
    "ASSIGNED",
    `${user.name} назначил(а) вас на ${task.project.key}-${task.number} «${task.title}»`
  );

  revalidateTask(d.projectId, task.parentId ?? undefined);
  return {};
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus) {
  const { user, task: current } = await requireTaskMember(taskId);
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
    include: { project: { select: { key: true } } },
  });
  await notifyTaskWatchers(
    taskId,
    user.id,
    "STATUS",
    `${user.name} перевёл(а) ${task.project.key}-${task.number} «${task.title}» в «${STATUS_LABELS[status]}»`
  );
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
  const { user, task: current } = await requireTaskMember(taskId);
  const assigneeIds =
    fields.assigneeIds !== undefined
      ? await filterProjectMembers(current.projectId, fields.assigneeIds)
      : undefined;
  // Запоминаем текущих исполнителей, чтобы уведомить только новых
  const prevAssignees =
    assigneeIds !== undefined
      ? (
          await prisma.task.findUniqueOrThrow({
            where: { id: taskId },
            select: { assignees: { select: { id: true } } },
          })
        ).assignees.map((a) => a.id)
      : [];
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
      ...(assigneeIds !== undefined
        ? { assignees: { set: assigneeIds.map((id) => ({ id })) } }
        : {}),
    },
    include: { project: { select: { key: true } } },
  });
  if (assigneeIds !== undefined) {
    const added = assigneeIds.filter((id) => !prevAssignees.includes(id));
    await notifyUsers(
      added,
      user.id,
      taskId,
      "ASSIGNED",
      `${user.name} назначил(а) вас на ${task.project.key}-${task.number} «${task.title}»`
    );
  }
  revalidateTask(task.projectId, taskId);
}

export async function deleteTaskAction(taskId: string) {
  const { user, task } = await requireTaskMember(taskId);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: task.projectId },
    select: { ownerId: true },
  });
  const allowed =
    task.creatorId === user.id || project.ownerId === user.id || isManager(user);
  if (!allowed) {
    throw new Error("Удалять задачу может её автор, менеджер или владелец проекта");
  }
  await prisma.task.delete({ where: { id: taskId } });
  revalidateTask(task.projectId);
}

export async function addTaskLinkAction(fromId: string, toId: string, type: "BLOCKS" | "RELATES" | "DUPLICATES") {
  if (fromId === toId) return;
  const { task: from } = await requireTaskMember(fromId);
  const to = await prisma.task.findUniqueOrThrow({
    where: { id: toId },
    select: { projectId: true },
  });
  if (to.projectId !== from.projectId) {
    throw new Error("Связывать можно только задачи одного проекта");
  }
  await prisma.taskLink.upsert({
    where: { fromId_toId_type: { fromId, toId, type } },
    update: {},
    create: { fromId, toId, type },
  });
  revalidateTask(from.projectId, fromId);
  revalidatePath(`/tasks/${toId}`);
}

export async function removeTaskLinkAction(linkId: string) {
  const existing = await prisma.taskLink.findUniqueOrThrow({
    where: { id: linkId },
    select: { fromId: true },
  });
  await requireTaskMember(existing.fromId);
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
  const taskId = String(formData.get("taskId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!taskId || title.length < 2) return { error: "Заголовок — минимум 2 символа" };
  if (!content) return { error: "Описание реализации обязательно" };

  const { user, task } = await requireTaskMember(taskId);
  await prisma.patchLog.create({
    data: { taskId, authorId: user.id, title, content },
  });
  const full = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { number: true, title: true, project: { select: { key: true } } },
  });
  await notifyTaskWatchers(
    taskId,
    user.id,
    "PATCHLOG",
    `${user.name} добавил(а) запись в патч-лог ${full.project.key}-${full.number}: «${title}»`
  );
  revalidateTask(task.projectId, taskId);
  return {};
}

// ===== Комментарии =====

export async function addCommentAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const taskId = String(formData.get("taskId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!taskId || !content) return { error: "Комментарий не может быть пустым" };

  const { user, task } = await requireTaskMember(taskId);
  await prisma.comment.create({
    data: { taskId, authorId: user.id, content: content.slice(0, 5000) },
  });
  const full = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { number: true, project: { select: { key: true } } },
  });
  await notifyTaskWatchers(
    taskId,
    user.id,
    "COMMENT",
    `${user.name} прокомментировал(а) ${full.project.key}-${full.number}: «${content.slice(0, 80)}${content.length > 80 ? "…" : ""}»`
  );
  revalidateTask(task.projectId, taskId);
  return {};
}

export async function deleteCommentAction(id: string) {
  const user = await requireUser();
  const comment = await prisma.comment.findUniqueOrThrow({
    where: { id },
    include: { task: true },
  });
  if (comment.authorId !== user.id && user.role !== "ADMIN") {
    throw new Error("Можно удалять только свои комментарии");
  }
  await prisma.comment.delete({ where: { id } });
  revalidateTask(comment.task.projectId, comment.taskId);
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
  const taskId = String(formData.get("taskId") ?? "");
  const hours = Number(formData.get("hours"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const date = String(formData.get("date") ?? "");
  if (!taskId || !Number.isFinite(hours) || hours <= 0) {
    return { error: "Укажите время больше нуля" };
  }

  const { user, task } = await requireTaskMember(taskId);
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

// ===== Чек-лист =====

/** Доступ к пункту чек-листа через членство в проекте его задачи. */
async function requireChecklistItem(id: string) {
  const item = await prisma.checklistItem.findUniqueOrThrow({
    where: { id },
    include: { task: { select: { id: true, projectId: true } } },
  });
  await requireProjectMember(item.task.projectId);
  return item;
}

export async function addChecklistItemAction(taskId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const { task } = await requireTaskMember(taskId);
  const last = await prisma.checklistItem.findFirst({
    where: { taskId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.checklistItem.create({
    data: { taskId, text: trimmed.slice(0, 500), order: (last?.order ?? 0) + 10 },
  });
  revalidateTask(task.projectId, taskId);
}

export async function toggleChecklistItemAction(id: string, done: boolean) {
  const item = await requireChecklistItem(id);
  await prisma.checklistItem.update({ where: { id }, data: { done } });
  revalidateTask(item.task.projectId, item.taskId);
}

export async function updateChecklistItemAction(id: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const item = await requireChecklistItem(id);
  await prisma.checklistItem.update({
    where: { id },
    data: { text: trimmed.slice(0, 500) },
  });
  revalidateTask(item.task.projectId, item.taskId);
}

export async function deleteChecklistItemAction(id: string) {
  const item = await requireChecklistItem(id);
  await prisma.checklistItem.delete({ where: { id } });
  revalidateTask(item.task.projectId, item.taskId);
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
