"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import {
  fetchTrelloBoards,
  fetchTrelloLists,
  fetchTrelloCards,
  type TrelloAuth,
} from "@/lib/trello";
import { BOARD_PALETTE } from "@/lib/labels";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const authSchema = z.object({
  key: z.string().trim().min(8, "Укажите API key Trello"),
  token: z.string().trim().min(8, "Укажите token Trello"),
});

/** Загружает список открытых досок пользователя для выбора в диалоге. */
export async function listTrelloBoardsAction(
  key: string,
  token: string
): Promise<{ boards?: { id: string; name: string }[]; error?: string }> {
  await requireUser();
  const parsed = authSchema.safeParse({ key, token });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  try {
    const boards = await fetchTrelloBoards(parsed.data);
    return {
      boards: boards
        .filter((b) => !b.closed)
        .map((b) => ({ id: b.id, name: b.name })),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ошибка Trello" };
  }
}

const importSchema = authSchema.extend({
  boardId: z.string().trim().min(8, "Выберите доску"),
  boardName: z.string().trim().min(1, "Выберите доску"),
  projectKey: z
    .string()
    .trim()
    .min(2)
    .max(6)
    .regex(/^[A-Za-z]+$/, "Ключ — только латинские буквы"),
});

/**
 * Импортирует доску Trello как новый проект:
 * списки → колонки доски, карточки → задачи, чек-листы карточек → чек-листы задач.
 * Закрытые (архивные в Trello) списки и карточки пропускаются.
 */
export async function importTrelloBoardAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = importSchema.safeParse({
    key: formData.get("key"),
    token: formData.get("token"),
    boardId: formData.get("boardId"),
    boardName: formData.get("boardName"),
    projectKey: formData.get("projectKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { key, token, boardId, boardName, projectKey } = parsed.data;

  const projKey = projectKey.toUpperCase();
  const exists = await prisma.project.findUnique({ where: { key: projKey } });
  if (exists) return { error: `Ключ «${projKey}» уже занят` };

  const auth: TrelloAuth = { key, token };
  let lists, cards;
  try {
    [lists, cards] = await Promise.all([
      fetchTrelloLists(boardId, auth),
      fetchTrelloCards(boardId, auth),
    ]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ошибка Trello" };
  }

  const project = await prisma.project.create({
    data: {
      name: boardName.slice(0, 120),
      key: projKey,
      description: "Импортировано из Trello",
      ownerId: user.id,
      members: { create: { userId: user.id } },
    },
  });

  // Списки → колонки доски (кастомные, без привязки к статусу — сохраняем структуру Trello)
  const openLists = lists
    .filter((l) => !l.closed)
    .sort((a, b) => a.pos - b.pos);
  const listToColumn = new Map<string, string>();
  for (let i = 0; i < openLists.length; i++) {
    const l = openLists[i]!;
    const col = await prisma.boardColumn.create({
      data: {
        projectId: project.id,
        name: l.name.slice(0, 60) || "Без названия",
        color: BOARD_PALETTE[i % BOARD_PALETTE.length]!,
        order: (i + 1) * 10,
      },
    });
    listToColumn.set(l.id, col.id);
  }

  // Карточки → задачи (+ чек-листы)
  const openCards = cards.filter((c) => !c.closed);
  for (const c of openCards) {
    const checkItems = (c.checklists ?? [])
      .flatMap((cl) => cl.checkItems ?? [])
      .sort((a, b) => a.pos - b.pos)
      .slice(0, 100);
    await prisma.task.create({
      data: {
        title: (c.name.trim() || "Без названия").slice(0, 500),
        description: c.desc?.trim() || null,
        projectId: project.id,
        columnId: listToColumn.get(c.idList) ?? null,
        dueDate: c.due ? new Date(c.due) : null,
        order: Number.isFinite(c.pos) ? c.pos : 0,
        creatorId: user.id,
        checklist: checkItems.length
          ? {
              create: checkItems.map((it, i) => ({
                text: it.name.slice(0, 500),
                done: it.state === "complete",
                order: (i + 1) * 10,
              })),
            }
          : undefined,
      },
    });
  }

  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}
