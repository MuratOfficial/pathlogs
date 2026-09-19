import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { projectScope } from "@/lib/access";
import { MyTasksList, type MyTask } from "@/components/MyTasksList";

/**
 * Все мои задачи по всем проектам. Отрисовка и поиск — в клиентском
 * MyTasksList: задач у одного человека десятки, и фильтровать их запросом
 * дешевле в браузере, чем ходить на сервер на каждую букву.
 */
export default async function MyTasksPage() {
  const user = await requireUser();

  const tasks = await prisma.task.findMany({
    where: {
      assignees: { some: { id: user.id } },
      status: { in: ["TODO", "IN_PROGRESS", "REVIEW"] },
      // Проект вне контура компании не показываем даже исполнителю задачи
      project: { is: { status: "ACTIVE", ...(await projectScope(user)) } },
    },
    include: {
      project: { select: { id: true, key: true, name: true } },
      timeEntries: { select: { hours: true } },
      checklist: { select: { done: true } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });

  const dto: MyTask[] = tasks.map((t) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    status: t.status,
    type: t.type,
    priority: t.priority,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    estimateHours: t.estimateHours,
    spentHours: t.timeEntries.reduce((sum, e) => sum + e.hours, 0),
    checklistDone: t.checklist.filter((i) => i.done).length,
    checklistTotal: t.checklist.length,
    projectId: t.project.id,
    projectKey: t.project.key,
    projectName: t.project.name,
  }));

  return <MyTasksList tasks={dto} />;
}
