import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import type { TaskDTO, LinkDTO, MemberDTO, ColumnDTO, TaskTemplateDTO } from "@/lib/types";
import { ensureDefaultColumns } from "@/lib/board";
import { canAccessProject, canManageProject } from "@/lib/access";
import { ProjectMembersDialog } from "@/components/ProjectMembersDialog";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TaskGraph } from "@/components/TaskGraph";
import { TaskListView } from "@/components/TaskListView";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { ArchiveProjectButton } from "@/components/ArchiveProjectButton";
import { ProjectStats } from "@/components/ProjectStats";
import { TemplatesDialog } from "@/components/TemplatesDialog";
import { GanttChart } from "@/components/GanttChart";
import { ActivityFeed } from "@/components/ActivityFeed";
import { getProjectActivity } from "@/lib/activity";
import { ShareRoadmapDialog } from "@/components/ShareRoadmapDialog";
import { WebhooksDialog } from "@/components/WebhooksDialog";
import { ExportMenu } from "@/components/ExportMenu";
import { formatHours } from "@/lib/labels";

/** Суммарные часы и стоимость по сотрудникам для вкладки «Аналитика». */
async function getHoursByUser(projectId: string) {
  const entries = await prisma.timeEntry.findMany({
    where: { task: { projectId } },
    select: { hours: true, user: { select: { name: true, hourlyRate: true } } },
  });
  const map = new Map<string, { hours: number; rate: number | null }>();
  for (const e of entries) {
    const cur = map.get(e.user.name) ?? { hours: 0, rate: e.user.hourlyRate };
    cur.hours += e.hours;
    map.set(e.user.name, cur);
  }
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      hours: v.hours,
      cost: v.rate != null ? v.hours * v.rate : null,
    }))
    .sort((a, b) => b.hours - a.hours);
}

/** Создано vs закрыто по неделям (последние 10 недель) для графика динамики. */
async function getCompletionSeries(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { createdAt: true, closedAt: true },
  });
  const WEEK = 7 * 86400000;
  const now = new Date();
  // Начало текущей недели (понедельник)
  const monday = new Date(now);
  const dow = (monday.getDay() + 6) % 7;
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - dow);

  const weeks = 10;
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(monday.getTime() - (weeks - 1 - i) * WEEK);
    return { start, created: 0, closed: 0 };
  });
  const firstStart = buckets[0]!.start.getTime();

  for (const t of tasks) {
    const ci = Math.floor((t.createdAt.getTime() - firstStart) / WEEK);
    if (ci >= 0 && ci < weeks) buckets[ci]!.created++;
    if (t.closedAt) {
      const xi = Math.floor((t.closedAt.getTime() - firstStart) / WEEK);
      if (xi >= 0 && xi < weeks) buckets[xi]!.closed++;
    }
  }

  return buckets.map((b) => ({
    label: b.start.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
    created: b.created,
    closed: b.closed,
  }));
}

const VIEWS = [
  { id: "board", label: "Канбан" },
  { id: "graph", label: "Граф веток" },
  { id: "list", label: "Список" },
  { id: "gantt", label: "Гант" },
  { id: "activity", label: "Активность" },
  { id: "stats", label: "Аналитика" },
] as const;

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { view: rawView } = await searchParams;
  const view = VIEWS.some((v) => v.id === rawView) ? rawView! : "board";

  // Чужой проект неотличим от несуществующего
  if (!(await canAccessProject(id, user))) notFound();

  await ensureDefaultColumns(id);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      tasks: {
        include: {
          assignees: { select: { id: true, name: true } },
          timeEntries: { select: { hours: true } },
          _count: { select: { patchLogs: true, children: true } },
        },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
      members: { include: { user: { select: { id: true, name: true } } } },
      owner: { select: { id: true, name: true } },
      columns: { orderBy: { order: "asc" } },
      templates: { orderBy: { createdAt: "asc" } },
      webhooks: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) notFound();

  const templates: TaskTemplateDTO[] = project.templates.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    priority: t.priority,
    titlePrefix: t.titlePrefix,
    description: t.description,
    estimateHours: t.estimateHours,
    checklist: t.checklist,
  }));

  const links = await prisma.taskLink.findMany({
    where: { from: { projectId: id } },
  });

  const savedFilters = await prisma.savedFilter.findMany({
    where: { projectId: id, userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, query: true },
  });

  const tasks: TaskDTO[] = project.tasks.map((t) => ({
    id: t.id,
    number: t.number,
    title: t.title,
    status: t.status,
    type: t.type,
    priority: t.priority,
    parentId: t.parentId,
    columnId: t.columnId,
    color: t.color,
    startDate: t.startDate?.toISOString() ?? null,
    dueDate: t.dueDate?.toISOString() ?? null,
    estimateHours: t.estimateHours,
    spentHours: t.timeEntries.reduce((s, e) => s + e.hours, 0),
    order: t.order,
    assignees: t.assignees,
    patchLogCount: t._count.patchLogs,
    childrenCount: t._count.children,
  }));

  const linkDtos: LinkDTO[] = links.map((l) => ({
    id: l.id,
    fromId: l.fromId,
    toId: l.toId,
    type: l.type,
  }));

  const columns: ColumnDTO[] = project.columns.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    order: c.order,
    status: c.status,
    wipLimit: c.wipLimit,
  }));

  const members: MemberDTO[] = project.members.some((m) => m.user.id === project.ownerId)
    ? project.members.map((m) => m.user)
    : [project.owner, ...project.members.map((m) => m.user)];
  const canManage = await canManageProject(id, user);
  // Кандидаты на добавление — только для тех, кто может управлять составом
  const candidates: MemberDTO[] = canManage
    ? await prisma.user.findMany({
        where: { active: true, id: { notIn: members.map((m) => m.id) } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const totalSpent = tasks.reduce((s, t) => s + t.spentHours, 0);
  const open = tasks.filter(
    (t) => t.status !== "DONE" && t.status !== "CLOSED" && t.status !== "ARCHIVED"
  ).length;

  return (
    <div className="mx-auto flex h-[calc(100vh-3rem)] min-w-0 max-w-[1600px] flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-muted transition hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <span className="rounded-md bg-accent/15 px-2 py-1 font-mono text-xs font-bold text-accent-hover">
            {project.key}
          </span>
          <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
          {project.status === "ARCHIVED" && (
            <span className="rounded-md bg-surface-2 px-2 py-1 text-xs text-muted">
              В архиве
            </span>
          )}
          {canManage && (
            <ArchiveProjectButton projectId={project.id} archived={project.status === "ARCHIVED"} />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="mr-1 hidden items-center gap-4 text-xs text-muted md:flex">
            <span>Открыто: <b className="text-foreground">{open}</b></span>
            <span>Всего: <b className="text-foreground">{tasks.length}</b></span>
            <span>Затрачено: <b className="text-foreground">{formatHours(totalSpent)}</b></span>
          </div>
          <ExportMenu projectId={project.id} />
          {canManage && (
            <ShareRoadmapDialog
              projectId={project.id}
              initialToken={project.publicToken}
            />
          )}
          <TemplatesDialog
            projectId={project.id}
            templates={templates}
            canManage={canManage}
          />
          <WebhooksDialog
            projectId={project.id}
            webhooks={project.webhooks.map((w) => ({
              id: w.id,
              kind: w.kind,
              url: w.url,
              target: w.target,
              active: w.active,
            }))}
            canManage={canManage}
          />
          <ProjectMembersDialog
            projectId={project.id}
            ownerId={project.ownerId}
            members={members}
            candidates={candidates}
            canManage={canManage}
          />
          <NewTaskDialog
            projectId={project.id}
            tasks={tasks}
            members={members}
            templates={templates}
          />
        </div>
      </div>

      <div className="no-scrollbar mb-4 flex w-fit max-w-full flex-nowrap gap-1 overflow-x-auto rounded-xl border border-edge bg-surface p-1">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={`/projects/${project.id}?view=${v.id}`}
            className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              view === v.id
                ? "bg-accent text-white"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <div className="min-h-0 min-w-0 flex-1">
        {view === "board" && (
          <KanbanBoard
            tasks={tasks}
            columns={columns}
            projectId={project.id}
            projectKey={project.key}
            canManageBoard={canManage}
          />
        )}
        {view === "graph" && (
          <TaskGraph
            tasks={tasks}
            links={linkDtos}
            projectName={project.name}
            projectKey={project.key}
          />
        )}
        {view === "list" && (
          <TaskListView
            tasks={tasks}
            projectKey={project.key}
            members={members}
            projectId={project.id}
            savedFilters={savedFilters}
          />
        )}
        {view === "gantt" && (
          <GanttChart tasks={tasks} projectKey={project.key} links={linkDtos} />
        )}
        {view === "activity" && (
          <ActivityFeed
            items={await getProjectActivity(project.id)}
            projectKey={project.key}
          />
        )}
        {view === "stats" && (
          <ProjectStats
            tasks={tasks}
            hoursByUser={await getHoursByUser(project.id)}
            completion={await getCompletionSeries(project.id)}
          />
        )}
      </div>
    </div>
  );
}
