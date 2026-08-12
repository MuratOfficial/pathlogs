import { prisma } from "@/lib/prisma";
import type { ProjectBackgroundDTO } from "@/lib/background";

/**
 * Персональный фон проекта для конкретного пользователя.
 * У каждого участника он свой — общего фона у проекта нет.
 */
export async function getProjectBackground(
  projectId: string,
  userId: string
): Promise<ProjectBackgroundDTO | null> {
  return prisma.projectAppearance.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { color: true, colorTo: true, angle: true },
  });
}

/** Фоны сразу нескольких проектов (боковое меню: закреплённые проекты). */
export async function getProjectBackgrounds(
  projectIds: string[],
  userId: string
): Promise<Map<string, ProjectBackgroundDTO>> {
  if (projectIds.length === 0) return new Map();
  const rows = await prisma.projectAppearance.findMany({
    where: { userId, projectId: { in: projectIds } },
    select: { projectId: true, color: true, colorTo: true, angle: true },
  });
  return new Map(
    rows.map((r) => [r.projectId, { color: r.color, colorTo: r.colorTo, angle: r.angle }])
  );
}
