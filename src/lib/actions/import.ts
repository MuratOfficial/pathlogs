"use server";

import type { Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { parseImportFile, type ParsedImport } from "@/lib/import";
import {
  BOARD_PALETTE,
  KANBAN_COLUMNS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/labels";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const MAX_SIZE = 15 * 1024 * 1024; // 15 МБ

/** Предлагает ключ проекта из латинских букв имени. */
function suggestKey(name: string): string {
  const letters = (name.match(/[A-Za-z]/g) ?? []).join("").toUpperCase();
  return (letters || "PROJ").slice(0, 4);
}

/** Читает и парсит файл из FormData. Бросает Error с понятным сообщением. */
async function parseFromForm(formData: FormData): Promise<ParsedImport> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Файл не выбран");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("Файл больше 15 МБ");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return parseImportFile(file.name, buffer);
}

export interface ImportPreview {
  format: "excel" | "msproject";
  total: number;
  suggestedName: string;
  suggestedKey: string;
  columnNames: string[];
  withParent: number;
  withAssignee: number;
  sample: {
    title: string;
    status: string;
    type: string;
    priority: string;
    column: string;
    assignees: string;
  }[];
}

/** Парсит файл и возвращает сводку для предпросмотра (без записи в БД). */
export async function previewImportAction(
  _prev: { error?: string; preview?: ImportPreview } | undefined,
  formData: FormData
): Promise<{ error?: string; preview?: ImportPreview }> {
  await requireUser();
  let parsed: ParsedImport;
  try {
    parsed = await parseFromForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось прочитать файл" };
  }

  const columnNames = Array.from(
    new Set(parsed.tasks.map((t) => t.columnName).filter((n): n is string => !!n))
  );
  const name = (parsed.projectName ?? "Импортированный проект").slice(0, 120);

  return {
    preview: {
      format: parsed.format,
      total: parsed.tasks.length,
      suggestedName: name,
      suggestedKey: suggestKey(name),
      columnNames,
      withParent: parsed.tasks.filter((t) => t.parentRef).length,
      withAssignee: parsed.tasks.filter((t) => t.assigneeEmails.length).length,
      sample: parsed.tasks.slice(0, 30).map((t) => ({
        title: t.title,
        status: t.status ? STATUS_LABELS[t.status] : "—",
        type: t.type ?? "—",
        priority: t.priority ?? "—",
        column: t.columnName ?? "—",
        assignees: t.assigneeEmails.join(", ") || "—",
      })),
    },
  };
}

/** Колонка по умолчанию, в которую падает задача с данным статусом. */
function columnKeyForStatus(status: TaskStatus | null): TaskStatus {
  switch (status) {
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "REVIEW":
      return "REVIEW";
    case "DONE":
    case "CLOSED":
    case "ARCHIVED":
      return "DONE";
    default:
      return "TODO";
  }
}

/**
 * Создаёт новый проект из загруженного файла Excel / MS Project XML.
 * Excel со столбцом «Колонка» → кастомные колонки (как в Trello);
 * иначе — стандартные колонки по статусу. Иерархия задач сохраняется.
 */
export async function importFileAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const user = await requireUser();

  const rawName = String(formData.get("projectName") ?? "").trim();
  const rawKey = String(formData.get("projectKey") ?? "").trim();
  if (rawName.length < 2) return { error: "Название — минимум 2 символа" };
  if (!/^[A-Za-z]{2,6}$/.test(rawKey)) {
    return { error: "Ключ — 2–6 латинских букв" };
  }
  const key = rawKey.toUpperCase();

  let parsed: ParsedImport;
  try {
    parsed = await parseFromForm(formData);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось прочитать файл" };
  }
  if (parsed.tasks.length === 0) return { error: "В файле нет задач" };

  const exists = await prisma.project.findUnique({ where: { key } });
  if (exists) return { error: `Ключ «${key}» уже занят` };

  // Сопоставляем исполнителей с существующими активными пользователями по e-mail
  const emails = Array.from(
    new Set(
      parsed.tasks
        .flatMap((t) => t.assigneeEmails)
        .map((e) => e.toLowerCase())
        .filter((e) => e.includes("@"))
    )
  );
  const matchedUsers = emails.length
    ? await prisma.user.findMany({
        where: { email: { in: emails }, active: true },
        select: { id: true, email: true },
      })
    : [];
  const emailToId = new Map(matchedUsers.map((u) => [u.email.toLowerCase(), u.id]));

  const project = await prisma.project.create({
    data: {
      name: rawName.slice(0, 120),
      key,
      description:
        parsed.format === "excel"
          ? "Импортировано из Excel"
          : "Импортировано из MS Project",
      ownerId: user.id,
      members: { create: { userId: user.id } },
    },
  });

  // Добавляем найденных исполнителей в участники проекта (кроме владельца)
  const memberIds = Array.from(
    new Set(matchedUsers.map((u) => u.id).filter((id) => id !== user.id))
  );
  if (memberIds.length) {
    await prisma.projectMember.createMany({
      data: memberIds.map((userId) => ({ projectId: project.id, userId })),
      skipDuplicates: true,
    });
  }

  // Колонки
  const usesCustomColumns = parsed.tasks.some((t) => t.columnName);
  const columnIdFor = new Map<string, string>(); // ключ группировки -> columnId

  if (usesCustomColumns) {
    const names = Array.from(
      new Set(parsed.tasks.map((t) => t.columnName ?? "Без статуса"))
    );
    for (let i = 0; i < names.length; i++) {
      const col = await prisma.boardColumn.create({
        data: {
          projectId: project.id,
          name: names[i]!.slice(0, 60),
          color: BOARD_PALETTE[i % BOARD_PALETTE.length]!,
          order: (i + 1) * 10,
        },
      });
      columnIdFor.set(names[i]!, col.id);
    }
  } else {
    for (let i = 0; i < KANBAN_COLUMNS.length; i++) {
      const status = KANBAN_COLUMNS[i]!;
      const col = await prisma.boardColumn.create({
        data: {
          projectId: project.id,
          name: STATUS_LABELS[status],
          color: STATUS_COLORS[status],
          status,
          order: (i + 1) * 10,
        },
      });
      columnIdFor.set(status, col.id);
    }
  }

  // Создаём задачи (первый проход — без родителя), запоминаем ref -> id
  const refToId = new Map<string, string>();
  for (const t of parsed.tasks) {
    const status = t.status ?? "TODO";
    const groupKey = usesCustomColumns
      ? t.columnName ?? "Без статуса"
      : columnKeyForStatus(t.status);
    const data: Prisma.TaskCreateInput = {
      title: t.title,
      description: t.description,
      status,
      project: { connect: { id: project.id } },
      creator: { connect: { id: user.id } },
      order: t.order,
      estimateHours: t.estimateHours,
      startDate: t.startDate,
      dueDate: t.dueDate,
      closedAt: status === "DONE" || status === "CLOSED" ? new Date() : null,
    };
    if (t.type) data.type = t.type;
    if (t.priority) data.priority = t.priority;
    const colId = columnIdFor.get(groupKey);
    if (colId) data.column = { connect: { id: colId } };

    const assigneeIds = t.assigneeEmails
      .map((e) => emailToId.get(e.toLowerCase()))
      .filter((id): id is string => !!id);
    if (assigneeIds.length) {
      data.assignees = { connect: assigneeIds.map((id) => ({ id })) };
    }

    const created = await prisma.task.create({ data, select: { id: true } });
    refToId.set(t.ref, created.id);
  }

  // Второй проход — проставляем иерархию
  const parentUpdates = parsed.tasks
    .filter((t) => t.parentRef && refToId.has(t.parentRef))
    .map((t) => ({ id: refToId.get(t.ref)!, parentId: refToId.get(t.parentRef!)! }))
    .filter((u) => u.id !== u.parentId);
  if (parentUpdates.length) {
    await prisma.$transaction(
      parentUpdates.map((u) =>
        prisma.task.update({ where: { id: u.id }, data: { parentId: u.parentId } })
      )
    );
  }

  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}
