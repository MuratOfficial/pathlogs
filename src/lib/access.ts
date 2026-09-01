import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import type { Prisma, Role } from "@prisma/client";

export type SessionUser = { id: string; email: string; name: string; role: Role };

/** Менеджер или администратор (глобальная роль). */
export function isManager(user: Pick<SessionUser, "role">) {
  return user.role === "ADMIN" || user.role === "MANAGER";
}

/**
 * Компания пользователя. Берём из БД, а не из сессии: админ может перевести
 * человека в другую компанию, и ждать перелогина ради этого незачем.
 */
export async function getUserCompanyId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true },
  });
  return user?.companyId ?? null;
}

/**
 * Условие видимости проекта для сотрудника компании.
 *
 * Проект без компании (создан до разделения) виден всем — иначе перевод
 * пользователя в компанию отрезал бы его от старых проектов. Такие проекты
 * привязывают к компаниям вручную в админке.
 */
function companyCondition(companyId: string | null): Prisma.ProjectWhereInput {
  return companyId ? { OR: [{ companyId }, { companyId: null }] } : { companyId: null };
}

/**
 * Фильтр проектов, доступных пользователю: участие плюс контур компании.
 * Админ видит все проекты — он же и распределяет их по компаниям.
 */
export async function projectScope(user: SessionUser): Promise<Prisma.ProjectWhereInput> {
  if (user.role === "ADMIN") return {};
  return {
    AND: [
      { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
      companyCondition(await getUserCompanyId(user.id)),
    ],
  };
}

async function membershipInfo(projectId: string, userId: string) {
  const [project, companyId] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        companyId: true,
        members: { where: { userId }, select: { id: true } },
      },
    }),
    getUserCompanyId(userId),
  ]);
  if (!project) return { exists: false, isOwner: false, isMember: false };
  // Чужая компания закрывает проект даже владельцу: контур компании сильнее
  // участия — иначе перевод сотрудника не отрезал бы его от прежних проектов.
  const sameCompany = project.companyId === null || project.companyId === companyId;
  const belongs = project.ownerId === userId || project.members.length > 0;
  return {
    exists: true,
    isOwner: sameCompany && project.ownerId === userId,
    isMember: sameCompany && belongs,
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

/**
 * Кого можно добавить в проект: активные пользователи компании проекта.
 * У проекта без компании ограничения нет — он вне контуров.
 */
export async function projectCandidateFilter(
  projectId: string
): Promise<Prisma.UserWhereInput> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });
  if (!project?.companyId) return { active: true };
  return { active: true, companyId: project.companyId };
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
