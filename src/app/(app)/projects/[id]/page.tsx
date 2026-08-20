import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import type {
  TaskDTO,
  LinkDTO,
  MemberDTO,
  ColumnDTO,
  TaskTemplateDTO,
  TagDTO,
} from "@/lib/types";
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
import { IntakeDialog } from "@/components/IntakeDialog";
import { BoardRulesDialog } from "@/components/BoardRulesDialog";
import { LiveBoard } from "@/components/LiveBoard";
import { MoreMenu } from "@/components/MoreMenu";
import { WebhooksDialog } from "@/components/WebhooksDialog";
import { ExportMenu } from "@/components/ExportMenu";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { PinProjectButton } from "@/components/PinProjectButton";
import { ProjectBackdrop } from "@/components/ProjectBackdrop";
import { ProjectBackgroundDialog } from "@/components/ProjectBackgroundDialog";
import { BackButton } from "@/components/BackButton";
import { getProjectBackground } from "@/lib/appearance";
import { PollsPanel } from "@/components/PollsPanel";
import { WorkloadPanel } from "@/components/WorkloadPanel";
import { SprintPanel } from "@/components/SprintPanel";
import { buildWorkload, unassignedCount } from "@/lib/workload";
import { ResourceLinks } from "@/components/ResourceLinks";
import { DragScroll } from "@/components/DragScroll";
import { getProjectPolls } from "@/lib/polls";
import { getResourceLinks } from "@/lib/links";
import { formatHours } from "@/lib/labels";

/** Суммарные часы по сотрудникам для вкладки «Аналитика». */
async function getHoursByUser(projectId: string) {
  const entries = await prisma.timeEntry.findMany({
    where: { task: { projectId } },
    select: { hours: true, user: { select: { name: true } } },
  });
  const map = new Map<string, number>();
  for (const e of entries) {
    map.set(e.user.name, (map.get(e.user.name) ?? 0) + e.hours);
  }
  return [...map.entries()]
    .map(([name, hours]) => ({ name, hours }))
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
  { id: "sprint", label: "Спринт" },
  { id: "workload", label: "Нагрузка" },
  { id: "polls", label: "Опрос" },
  { id: "links", label: "Ссылки" },
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
          tags: { select: { id: true, name: true, color: true } },
          timeEntries: { select: { hours: true } },
          checklist: { select: { done: true } },
          _count: { select: { patchLogs: true, children: true } },
        },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
      tags: { orderBy: { name: "asc" }, select: { id: true, name: true, color: true } },
      members: { include: { user: { select: { id: true, name: true } } } },
      owner: { select: { id: true, name: true } },
      columns: { orderBy: { order: "asc" } },
      templates: { orderBy: { createdAt: "asc" } },
      webhooks: { orderBy: { createdAt: "asc" } },
      intakeForm: { select: { token: true, columnId: true, active: true } },
      sprints: { orderBy: { startsAt: "desc" } },
      boardRules: { orderBy: { createdAt: "asc" } },
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

  // Сколько подзадач уже выполнено — считаем по самим задачам проекта,
  // они и так все загружены (лишний запрос в БД не нужен)
  const doneChildren = new Map<string, number>();
  for (const t of project.tasks) {
    if (t.parentId && (t.status === "DONE" || t.status === "CLOSED")) {
      doneChildren.set(t.parentId, (doneChildren.get(t.parentId) ?? 0) + 1);
    }
  }

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
    createdAt: t.createdAt.toISOString(),
    assignees: t.assignees,
    tags: t.tags,
    patchLogCount: t._count.patchLogs,
    childrenCount: t._count.children,
    childrenDoneCount: doneChildren.get(t.id) ?? 0,
    checklistCount: t.checklist.length,
    checklistDoneCount: t.checklist.filter((c) => c.done).length,
  }));

  // Спринтовые поля держим рядом с задачами: панель спринта считает по ним
  // сгорание, а тащить их в общий TaskDTO незачем — они нужны только ей
  const sprintTasks = project.tasks.map((t, i) => ({
    ...tasks[i]!,
    sprintId: t.sprintId,
    closedAt: t.closedAt?.toISOString() ?? null,
  }));

  const projectTags: TagDTO[] = project.tags;

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
    sort: c.sort,
    hidden: c.hidden,
  }));

  const members: MemberDTO[] = project.members.some((m) => m.user.id === project.ownerId)
    ? project.members.map((m) => m.user)
    : [project.owner, ...project.members.map((m) => m.user)];
  const canManage = await canManageProject(id, user);
  const pinned = Boolean(
    await prisma.projectPin.findUnique({
      where: { userId_projectId: { userId: user.id, projectId: id } },
      select: { id: true },
    })
  );
  // Фон проекта персональный: у каждого участника свой
  const background = await getProjectBackground(id, user.id);
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
    <div className="mx-auto flex h-[calc(100vh-3rem)] min-w-0 max-w-full flex-col">
      <ProjectBackdrop background={background} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          {/* <Link href="/dashboard" data-tip="Все проекты" className="text-muted transition hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link> */}
          <span className="rounded-md bg-accent/15 px-2 py-1 font-mono text-xs font-bold text-accent-hover">
            {project.key}
          </span>
          <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>
          {project.status === "ARCHIVED" && (
            <span className="rounded-md bg-surface-2 px-2 py-1 text-xs text-muted">
              В архиве
            </span>
          )}
          <PinProjectButton projectId={project.id} pinned={pinned} />
          <ProjectBackgroundDialog projectId={project.id} background={background} />
          {canManage && (
            <>
              <EditProjectDialog
                projectId={project.id}
                name={project.name}
                projectKey={project.key}
                description={project.description}
              />
              <ArchiveProjectButton
                projectId={project.id}
                archived={project.status === "ARCHIVED"}
              />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="mr-1 hidden items-center gap-4 text-xs text-muted md:flex">
            <span>Открыто: <b className="text-foreground">{open}</b></span>
            <span>Всего: <b className="text-foreground">{tasks.length}</b></span>
            <span>Затрачено: <b className="text-foreground">{formatHours(totalSpent)}</b></span>
          </div>
          {/* В шапке — только то, чем пользуются каждый день; остальное
              спрятано в «Ещё», чтобы панель не превращалась в частокол */}
          <MoreMenu count={canManage ? 7 : 4}>
            <ExportMenu projectId={project.id} />
            <TemplatesDialog
              projectId={project.id}
              templates={templates}
              canManage={canManage}
            />
            <ProjectMembersDialog
              projectId={project.id}
              members={members}
              candidates={candidates}
              ownerId={project.ownerId}
              canManage={canManage}
            />
            {canManage && (
              <ShareRoadmapDialog
                projectId={project.id}
                initialToken={project.publicToken}
              />
            )}
            {canManage && (
              <BoardRulesDialog
                projectId={project.id}
                columns={columns}
                members={members}
                tags={projectTags}
                rules={project.boardRules.map((r) => ({
                  id: r.id,
                  columnId: r.columnId,
                  setStatus: r.setStatus,
                  assignUserId: r.assignUserId,
                  addTagId: r.addTagId,
                  active: r.active,
                }))}
              />
            )}
            {canManage && (
              <IntakeDialog
                projectId={project.id}
                columns={columns}
                initial={project.intakeForm}
              />
            )}
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
          </MoreMenu>
          {/* На канбане задачи создаются кнопкой внутри колонки — здесь дубль не нужен */}
          {view !== "board" && (
            <NewTaskDialog
              projectId={project.id}
              tasks={tasks}
              members={members}
              templates={templates}
              projectTags={projectTags}
            />
          )}
        </div>
      </div>

      {project.description && (
        <p className="mb-4 max-w-3xl whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-muted">
          {project.description}
        </p>
      )}

      <DragScroll className="no-scrollbar mb-4 flex w-fit max-w-full flex-nowrap gap-1 overflow-x-auto rounded-xl border border-edge bg-surface p-1">
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
      </DragScroll>

      <div className="min-h-0 min-w-0 flex-1">
        {view === "board" && (
          <KanbanBoard
            tasks={tasks}
            columns={columns}
            projectId={project.id}
            projectKey={project.key}
            canManageBoard={canManage}
            members={members}
            templates={templates}
            projectTags={projectTags}
            savedFilters={savedFilters}
            toolbarExtra={<LiveBoard projectId={project.id} />}
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
            projectTags={projectTags}
            toolbarExtra={<LiveBoard projectId={project.id} />}
          />
        )}
        {view === "gantt" && (
          <GanttChart tasks={tasks} projectKey={project.key} links={linkDtos} />
        )}
        {view === "sprint" && (
          <SprintPanel
            projectId={project.id}
            projectKey={project.key}
            canManage={canManage}
            sprints={project.sprints.map((s) => ({
              id: s.id,
              name: s.name,
              goal: s.goal,
              startsAt: s.startsAt.toISOString(),
              endsAt: s.endsAt.toISOString(),
              closedAt: s.closedAt?.toISOString() ?? null,
            }))}
            tasks={sprintTasks}
          />
        )}
        {view === "workload" && (
          <WorkloadPanel
            rows={buildWorkload(
              tasks,
              [
                { id: project.owner.id, name: project.owner.name },
                ...project.members.map((m) => ({ id: m.user.id, name: m.user.name })),
              ]
            )}
            unassigned={unassignedCount(tasks)}
          />
        )}
        {view === "polls" && (
          <PollsPanel
            projectId={project.id}
            polls={await getProjectPolls(project.id, user)}
          />
        )}
        {view === "links" && (
          <div className="h-full overflow-y-auto pb-4">
            <div className="mx-auto max-w-full">
              <p className="mb-4 text-sm text-muted">
                Общие материалы проекта: документация, макеты, дашборды, регламенты.
                Ссылки, привязанные к конкретным задачам, живут в самих задачах.
              </p>
              <ResourceLinks
                projectId={project.id}
                links={await getResourceLinks(project.id, user)}
              />
            </div>
          </div>
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
