"use server";

import { prisma } from "@/lib/prisma";
import { isManager, requireProjectMember } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const MAX_OPTIONS = 20;

const pollSchema = z.object({
  projectId: z.string().min(1),
  question: z.string().trim().min(3, "Вопрос — минимум 3 символа").max(300),
  description: z.string().trim().max(2000).optional(),
  multiple: z.boolean(),
  anonymous: z.boolean(),
});

/** «Вариант на строку» → массив непустых вариантов без дублей. */
function parseOptions(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const text = line.replace(/^\s*[-*]\s*/, "").trim().slice(0, 200);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}

/**
 * Доступ к опросу: участник проекта — для чтения и голосования;
 * автор опроса, менеджер проекта или админ — для закрытия и удаления.
 */
async function requirePollAccess(pollId: string) {
  const poll = await prisma.poll.findUniqueOrThrow({
    where: { id: pollId },
    select: { id: true, projectId: true, authorId: true, closedAt: true },
  });
  const user = await requireProjectMember(poll.projectId);
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: poll.projectId },
    select: { ownerId: true },
  });
  const canManage =
    poll.authorId === user.id || project.ownerId === user.id || isManager(user);
  return { poll, user, canManage };
}

/** Создаёт опрос. Может любой участник проекта. */
export async function createPollAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = pollSchema.safeParse({
    projectId: formData.get("projectId"),
    question: formData.get("question"),
    description: formData.get("description") || undefined,
    multiple: formData.get("multiple") === "on",
    anonymous: formData.get("anonymous") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const d = parsed.data;
  const user = await requireProjectMember(d.projectId);

  const options = parseOptions(String(formData.get("options") ?? ""));
  if (options.length < 2) return { error: "Нужно минимум два варианта ответа" };

  await prisma.poll.create({
    data: {
      projectId: d.projectId,
      authorId: user.id,
      question: d.question,
      description: d.description || null,
      multiple: d.multiple,
      anonymous: d.anonymous,
      options: {
        create: options.map((text, i) => ({ text, order: (i + 1) * 10 })),
      },
    },
  });

  revalidatePath(`/projects/${d.projectId}`);
  return {};
}

/**
 * Записывает голос: полностью заменяет прежний выбор пользователя.
 * Пустой массив снимает голос. В опросе с одиночным выбором
 * учитывается только первый вариант.
 */
export async function votePollAction(pollId: string, optionIds: string[]) {
  const poll = await prisma.poll.findUniqueOrThrow({
    where: { id: pollId },
    select: {
      id: true,
      projectId: true,
      multiple: true,
      closedAt: true,
      options: { select: { id: true } },
    },
  });
  const user = await requireProjectMember(poll.projectId);
  if (poll.closedAt) throw new Error("Опрос завершён");

  const valid = new Set(poll.options.map((o) => o.id));
  let chosen = optionIds.filter((id) => valid.has(id));
  if (!poll.multiple) chosen = chosen.slice(0, 1);

  await prisma.$transaction([
    prisma.pollVote.deleteMany({ where: { pollId, userId: user.id } }),
    ...(chosen.length
      ? [
          prisma.pollVote.createMany({
            data: chosen.map((optionId) => ({ pollId, optionId, userId: user.id })),
          }),
        ]
      : []),
  ]);

  revalidatePath(`/projects/${poll.projectId}`);
}

/** Завершает или переоткрывает опрос. Автор, менеджер проекта или админ. */
export async function togglePollClosedAction(pollId: string) {
  const { poll, canManage } = await requirePollAccess(pollId);
  if (!canManage) throw new Error("Завершить опрос может автор или менеджер проекта");
  await prisma.poll.update({
    where: { id: pollId },
    data: { closedAt: poll.closedAt ? null : new Date() },
  });
  revalidatePath(`/projects/${poll.projectId}`);
}

/** Удаляет опрос вместе с вариантами и голосами. Автор, менеджер проекта или админ. */
export async function deletePollAction(pollId: string) {
  const { poll, canManage } = await requirePollAccess(pollId);
  if (!canManage) throw new Error("Удалить опрос может автор или менеджер проекта");
  await prisma.poll.delete({ where: { id: pollId } });
  revalidatePath(`/projects/${poll.projectId}`);
}
