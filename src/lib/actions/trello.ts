"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import {
  fetchTrelloBoards,
  fetchTrelloLists,
  fetchTrelloCards,
  type TrelloAuth,
} from "@/lib/trello";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { BOARD_PALETTE } from "@/lib/labels";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const authSchema = z.object({
  key: z.string().trim().min(8, "Укажите API key Trello"),
  token: z.string().trim().min(8, "Укажите token Trello"),
});

/** Возвращает сохранённые (расшифрованные) креды Trello пользователя либо null. */
async function getSavedAuth(userId: string): Promise<TrelloAuth | null> {
  const cred = await prisma.trelloCredential.findUnique({ where: { userId } });
  if (!cred) return null;
  try {
    return { key: decryptSecret(cred.apiKey), token: decryptSecret(cred.token) };
  } catch {
    // Ключ шифрования сменился или запись повреждена — считаем, что кред нет
    return null;
  }
}

/**
 * Сохраняет (с проверкой) учётные данные Trello пользователя в зашифрованном виде.
 * Перед сохранением убеждаемся, что креды рабочие — запрашиваем доски.
 */
export async function saveTrelloCredentialsAction(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const parsed = authSchema.safeParse({
    key: formData.get("key"),
    token: formData.get("token"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  try {
    await fetchTrelloBoards(parsed.data); // проверка валидности
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ошибка Trello" };
  }
  await prisma.trelloCredential.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      apiKey: encryptSecret(parsed.data.key),
      token: encryptSecret(parsed.data.token),
    },
    update: {
      apiKey: encryptSecret(parsed.data.key),
      token: encryptSecret(parsed.data.token),
    },
  });
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Удаляет сохранённые креды Trello пользователя. */
export async function deleteTrelloCredentialsAction() {
  const user = await requireUser();
  await prisma.trelloCredential.deleteMany({ where: { userId: user.id } });
  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

/**
 * Загружает доски пользователя. Если key/token не переданы — берёт сохранённые.
 * remember=true сохраняет переданные креды при успехе.
 */
export async function listTrelloBoardsAction(
  key?: string,
  token?: string,
  remember?: boolean
): Promise<{ boards?: { id: string; name: string }[]; error?: string }> {
  const user = await requireUser();

  let auth: TrelloAuth;
  if (key && token) {
    const parsed = authSchema.safeParse({ key, token });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
    }
    auth = parsed.data;
  } else {
    const saved = await getSavedAuth(user.id);
    if (!saved) return { error: "Нет сохранённых данных Trello" };
    auth = saved;
  }

  try {
    const boards = await fetchTrelloBoards(auth);
    if (key && token && remember) {
      await prisma.trelloCredential.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          apiKey: encryptSecret(auth.key),
          token: encryptSecret(auth.token),
        },
        update: {
          apiKey: encryptSecret(auth.key),
          token: encryptSecret(auth.token),
        },
      });
      revalidatePath("/dashboard");
      revalidatePath("/profile");
    }
    return {
      boards: boards
        .filter((b) => !b.closed)
        .map((b) => ({ id: b.id, name: b.name })),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Ошибка Trello" };
  }
}

const importSchema = z.object({
  // key/token опциональны: при отсутствии используются сохранённые креды
  key: z.string().trim().optional(),
  token: z.string().trim().optional(),
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
    key: formData.get("key") || undefined,
    token: formData.get("token") || undefined,
    boardId: formData.get("boardId"),
    boardName: formData.get("boardName"),
    projectKey: formData.get("projectKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const { key, token, boardId, boardName, projectKey } = parsed.data;

  const auth: TrelloAuth | null =
    key && token ? { key, token } : await getSavedAuth(user.id);
  if (!auth) return { error: "Нет данных Trello для импорта" };

  const projKey = projectKey.toUpperCase();
  const exists = await prisma.project.findUnique({ where: { key: projKey } });
  if (exists) return { error: `Ключ «${projKey}» уже занят` };

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
