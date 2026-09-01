import { prisma } from "@/lib/prisma";
import { projectScope, type SessionUser } from "@/lib/access";

/**
 * Проект, привязанный к задаче как подзадача. Прогресс считается по задачам
 * самого проекта — карточка ведёт себя как «крупная подзадача».
 */
export interface SubProjectDTO {
  id: string;
  key: string;
  name: string;
  description: string | null;
  archived: boolean;
  taskCount: number;
  doneCount: number;
}

/** Задача, к которой привязан проект (для «хлебных крошек» проекта). */
export interface ParentTaskDTO {
  id: string;
  number: number;
  title: string;
  projectKey: string;
}

/** Сколько шагов вверх по цепочке проект → родительская задача разбираем. */
const MAX_DEPTH = 20;

/**
 * Проекты, стоящие в цепочке выше данного (через родительские задачи),
 * включая его самого.
 *
 * Нужно для защиты от цикла: привязать проект-предок как подзадачу нельзя,
 * иначе получится замкнутое кольцо, по которому не пройти ни вверх, ни вниз.
 */
export async function ancestorProjectIds(projectId: string): Promise<Set<string>> {
  const seen = new Set<string>([projectId]);
  let frontier = [projectId];

  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    const links = await prisma.taskProjectLink.findMany({
      where: { projectId: { in: frontier } },
      select: { task: { select: { projectId: true } } },
    });
    frontier = [];
    for (const l of links) {
      if (seen.has(l.task.projectId)) continue;
      seen.add(l.task.projectId);
      frontier.push(l.task.projectId);
    }
  }
  return seen;
}

/** Проекты-подзадачи задачи вместе с прогрессом по их задачам. */
export async function getSubProjects(taskId: string): Promise<SubProjectDTO[]> {
  const links = await prisma.taskProjectLink.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    select: {
      project: {
        select: {
          id: true,
          key: true,
          name: true,
          description: true,
          status: true,
          _count: { select: { tasks: true } },
          tasks: { where: { status: { in: ["DONE", "CLOSED"] } }, select: { id: true } },
        },
      },
    },
  });

  return links.map(({ project: p }) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    archived: p.status === "ARCHIVED",
    taskCount: p._count.tasks,
    doneCount: p.tasks.length,
  }));
}

/** Задачи, к которым привязан проект (обычно ноль или одна). */
export async function getParentTasks(projectId: string): Promise<ParentTaskDTO[]> {
  const links = await prisma.taskProjectLink.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      task: {
        select: {
          id: true,
          number: true,
          title: true,
          project: { select: { key: true } },
        },
      },
    },
  });
  return links.map(({ task: t }) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    projectKey: t.project.key,
  }));
}

/**
 * Что можно привязать к задаче: доступные пользователю активные проекты,
 * кроме проекта самой задачи, уже привязанных и проектов-предков (цикл).
 */
export async function getAttachableProjects(
  taskId: string,
  projectId: string,
  user: SessionUser
): Promise<{ id: string; key: string; name: string }[]> {
  const [linked, blocked, projects] = await Promise.all([
    prisma.taskProjectLink.findMany({ where: { taskId }, select: { projectId: true } }),
    ancestorProjectIds(projectId),
    prisma.project.findMany({
      where: { status: "ACTIVE", ...(await projectScope(user)) },
      select: { id: true, key: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const taken = new Set(linked.map((l) => l.projectId));
  return projects.filter((p) => !taken.has(p.id) && !blocked.has(p.id));
}
