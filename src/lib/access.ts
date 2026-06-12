import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import type { Role } from "@prisma/client";

export type SessionUser = { id: string; email: string; name: string; role: Role };

/** Менеджер или администратор (глобальная роль). */
export function isManager(user: Pick<SessionUser, "role">) {
  return user.role === "ADMIN" || user.role === "MANAGER";
}

async function membershipInfo(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      members: { where: { userId }, select: { id: true } },
    },
  });
  if (!project) return { exists: false, isOwner: false, isMember: false };
  return {
    exists: true,
    isOwner: project.ownerId === userId,
    isMember: project.ownerId === userId || project.members.length > 0,
  };
}

/** Доступ к проекту: владелец, участник или глобальный админ. */
export async function canAccessProject(
  projectId: string,
  user: SessionUser
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  const m = await membershipInfo(projectId, user.id);
  return m.isMember;
}

/** Требует участия в проекте (или роль админа). Бросает ошибку для server actions. */
export async function requireProjectMember(projectId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await canAccessProject(projectId, user))) {
    throw new Error("Нет доступа к проекту");
  }
  return user;
}

/**
 * Требует права управления проектом: владелец, админ,
 * или менеджер, состоящий в проекте.
 */
export async function requireProjectManager(projectId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "ADMIN") return user;
  const m = await membershipInfo(projectId, user.id);
  if (m.isOwner) return user;
  if (user.role === "MANAGER" && m.isMember) return user;
  throw new Error("Требуются права менеджера проекта");
}

/** Доступ к задаче через членство в её проекте. */
export async function requireTaskMember(taskId: string) {
  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { id: true, projectId: true, creatorId: true },
  });
  const user = await requireProjectMember(task.projectId);
  return { user, task };
}

/** Оставляет из списка только участников проекта (включая владельца). */
export async function filterProjectMembers(
  projectId: string,
  userIds: string[]
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      members: {
        where: { userId: { in: userIds } },
        select: { userId: true },
      },
    },
  });
  if (!project) return [];
  const allowed = new Set(project.members.map((m) => m.userId));
  allowed.add(project.ownerId);
  return userIds.filter((id) => allowed.has(id));
}

/** Может ли user управлять проектом (для условного рендера UI). */
export async function canManageProject(
  projectId: string,
  user: SessionUser
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  const m = await membershipInfo(projectId, user.id);
  return m.isOwner || (user.role === "MANAGER" && m.isMember);
}
