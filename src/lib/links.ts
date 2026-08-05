import { prisma } from "@/lib/prisma";
import { isManager, type SessionUser } from "@/lib/access";
import type { ResourceLinkDTO } from "@/lib/types";

/**
 * Ссылки проекта (taskId === null) или конкретной задачи.
 * Право на правку считаем здесь: автор, владелец проекта или менеджер.
 */
export async function getResourceLinks(
  projectId: string,
  user: SessionUser,
  taskId?: string
): Promise<ResourceLinkDTO[]> {
  const [links, project] = await Promise.all([
    prisma.resourceLink.findMany({
      where: { projectId, taskId: taskId ?? null },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, name: true } } },
    }),
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { ownerId: true },
    }),
  ]);

  const managerHere = project.ownerId === user.id || isManager(user);
  return links.map((l) => ({
    id: l.id,
    url: l.url,
    title: l.title,
    description: l.description,
    author: l.author,
    createdAt: l.createdAt.toISOString(),
    canEdit: l.authorId === user.id || managerHere,
  }));
}
