"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";

export type SearchResult = {
  projects: { id: string; key: string; name: string }[];
  tasks: {
    id: string;
    number: number;
    title: string;
    projectKey: string;
  }[];
};

/**
 * Поиск для командной палитры (⌘K): проекты и задачи, доступные пользователю.
 * Пустой запрос — недавние проекты (для контента палитры при открытии).
 */
export async function searchAction(query: string): Promise<SearchResult> {
  const user = await requireUser();
  const q = query.trim();

  // Фильтр доступа к проектам: админ видит всё, остальные — свои/участие
  const access =
    user.role === "ADMIN"
      ? {}
      : {
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } },
          ],
        };

  const projects = await prisma.project.findMany({
    where: {
      ...access,
      status: "ACTIVE",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { key: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: { id: true, key: true, name: true },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });

  let tasks: SearchResult["tasks"] = [];
  if (q) {
    // Поддержка поиска по номеру: "123" или "PAY-12"
    const numMatch = q.match(/(\d+)\s*$/);
    const num = numMatch ? parseInt(numMatch[1]!, 10) : null;

    const rows = await prisma.task.findMany({
      where: {
        project: { is: access },
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          ...(num != null ? [{ number: num }] : []),
        ],
      },
      select: {
        id: true,
        number: true,
        title: true,
        project: { select: { key: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    });
    tasks = rows.map((t) => ({
      id: t.id,
      number: t.number,
      title: t.title,
      projectKey: t.project.key,
    }));
  }

  return { projects, tasks };
}
