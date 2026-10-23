import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import {
  canAccessProject,
  canManageProject,
  projectCandidateFilter,
} from "@/lib/access";
import { ProjectMembersDialog } from "@/components/ProjectMembersDialog";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TaskGraph } from "@/components/TaskGraph";
import { TaskListView } from "@/components/TaskListView";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { ProjectStats } from "@/components/ProjectStats";
import { FlowPanel } from "@/components/FlowPanel";
import { ProjectStatusBar } from "@/components/ProjectStatusBar";
import { GanttChart } from "@/components/GanttChart";
import { ActivityFeed } from "@/components/ActivityFeed";
import { getProjectActivity } from "@/lib/activity";
import { LiveBoard } from "@/components/LiveBoard";
import { ExportMenu } from "@/components/ExportMenu";
import { PinProjectButton } from "@/components/PinProjectButton";
import { ProjectBackdrop } from "@/components/ProjectBackdrop";
import { BackButton } from "@/components/BackButton";
import { getProjectBackground } from "@/lib/appearance";
import { PollsPanel } from "@/components/PollsPanel";
import { WorkloadPanel } from "@/components/WorkloadPanel";
import { SprintPanel } from "@/components/SprintPanel";
import { buildWorkload, unassignedCount } from "@/lib/workload";
import { ResourceLinks } from "@/components/ResourceLinks";
import { getProjectPolls } from "@/lib/polls";
import { getResourceLinks } from "@/lib/links";
import { getParentTasks } from "@/lib/subprojects";
import { Card, SectionTitle } from "@/components/ui/Card";
import { SectionTabs } from "@/components/ui/SectionTabs";
import { Icon } from "@/components/ui/Icon";
import {
  cycleTimeMs,
  flowSummary,
  weeklyFlow,
  type FlowTask,
} from "@/lib/flow";

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

/**
 * Сколько открытых задач просрочено. Отдельной функцией, а не строкой в
 * компоненте: «сейчас» — значение непостоянное, и внутри рендера его читать
 * нельзя (react-hooks/purity).
 */
function countOverdue(tasks: { dueDate: Date | string | null }[]): number {
  const now = Date.now();
  return tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < now).length;
}

/** Сколько недель показывают графики потока. */
const FLOW_WEEKS = 10;

/**
 * Задачи с историей переходов для метрик потока.
 *
 * Берём только toStatus и время: остальное в TaskStatusEvent (кто двигал)
 * нужно ленте задачи, а не агрегату, и тянуть его на каждую задачу проекта
 * значило бы возить по сети лишнее.
 */
async function getFlow(projectId: string, projectKey: string) {
  const rows = await prisma.task.findMany({
    where: { projectId },
    select: {
      id: true,
      number: true,
      title: true,
      createdAt: true,
      statusEvents: {
        select: { toStatus: true, at: true },
        orderBy: { at: "asc" },
      },
    },
  });

  const tasks: FlowTask[] = rows.map((t) => ({
    id: t.id,
    key: `${projectKey}-${t.number}`,
    title: t.title,
    createdAt: t.createdAt,
    events: t.statusEvents,
  }));

  const slowest = tasks
    .map((t) => ({ task: t, ms: cycleTimeMs(t) }))
    .filter((r): r is { task: FlowTask; ms: number } => r.ms !== null)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 6)
    .map((r) => ({
      id: r.task.id,
      key: r.task.key,
      title: r.task.title,
      hours: r.ms / 3600_000,
    }));

  return {
    summary: flowSummary(tasks, FLOW_WEEKS),
    weeks: weeklyFlow(tasks, FLOW_WEEKS),
    slowest,
  };
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

// Вкладки — только виды на проект. Материалы, опросы и журнал собраны в
// «О проекте», всё про время и зависимости — в «Плане», нагрузка — в аналитике.
const VIEWS = [
  { id: "board", label: "Доска" },
  { id: "list", label: "Список" },
  { id: "plan", label: "План" },
  { id: "stats", label: "Аналитика" },
  { id: "about", label: "О проекте" },
] as const;

/** Режимы вкладки «План». */
const PLAN_MODES = [
  { id: "gantt", label: "Сроки" },
  { id: "sprint", label: "Спринты" },
  { id: "graph", label: "Граф веток" },
] as const;

/** Адреса вкладок до объединения: они остались в закладках и письмах. */
const LEGACY_VIEWS: Record<string, string> = {
  gantt: "view=plan&plan=gantt",
  sprint: "view=plan&plan=sprint",
  graph: "view=plan&plan=graph",
  workload: "view=stats",
  polls: "view=about",
  links: "view=about",
  activity: "view=about",
};

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; plan?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { view: rawView, plan: rawPlan } = await searchParams;

  // Чужой проект неотличим от несуществующего
  if (!(await canAccessProject(id, user))) notFound();

  if (rawView && LEGACY_VIEWS[rawView]) redirect(`/projects/${id}?${LEGACY_VIEWS[rawView]}`);
  const view = VIEWS.some((v) => v.id === rawView) ? rawView! : "board";
  const plan = PLAN_MODES.some((m) => m.id === rawPlan) ? rawPlan! : "gantt";

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
      sprints: { orderBy: { startsAt: "desc" } },
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

  // Данные вкладки «О проекте» грузим, только когда она открыта
  const about =
    view === "about"
      ? {
          links: await getResourceLinks(id, user),
          polls: await getProjectPolls(id, user),
          activity: await getProjectActivity(id),
        }
      : null;

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
  // Задачи, к которым проект привязан как подзадача — путь «наверх»
  const parentTasks = await getParentTasks(id);
  // Фон проекта персональный: у каждого участника свой
  const background = await getProjectBackground(id, user.id);
  // Кандидаты на добавление — только для тех, кто может управлять составом.
  // Из чужой компании в проект никого не добавить (см. projectCandidateFilter)
  const candidates: MemberDTO[] = canManage
    ? await prisma.user.findMany({
        where: {
          ...(await projectCandidateFilter(id)),
          id: { notIn: members.map((m) => m.id) },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const totalSpent = tasks.reduce((s, t) => s + t.spentHours, 0);
  const openTasks = tasks.filter(
    (t) => t.status !== "DONE" && t.status !== "CLOSED" && t.status !== "ARCHIVED"
  );
  const open = openTasks.length;
  const overdue = countOverdue(openTasks);

  return (
    <div className="mx-auto flex h-[calc(100vh-3rem)] min-w-0 max-w-full flex-col">
      <ProjectBackdrop background={background} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* min-w-0 + flex-wrap: на телефоне кнопки у заголовка переносятся на
            вторую строку, а не выталкивают страницу вбок за край экрана */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
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
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* В шапке — то, чем пользуются каждый день. Шаблоны, правила доски,
              заявки, роадмап, интеграции, фон и архив — на странице настроек,
              а не восемью окнами из шапки и меню «Ещё» */}
          <ExportMenu projectId={project.id} />
          <ProjectMembersDialog
            projectId={project.id}
            members={members}
            candidates={candidates}
            ownerId={project.ownerId}
            canManage={canManage}
          />
          <Link
            href={`/projects/${project.id}/settings`}
            data-tip="Настройки проекта"
            aria-label="Настройки проекта"
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <Icon name="settings" className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Настройки</span>
          </Link>
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

      {parentTasks.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Подзадача задачи:</span>
          {parentTasks.map((t) => (
            <Link
              key={t.id}
              href={`/tasks/${t.id}`}
              className="rounded-lg border border-edge px-2 py-1 transition hover:bg-surface-2 hover:text-foreground"
            >
              <span className="font-mono font-semibold">
                {t.projectKey}-{t.number}
              </span>{" "}
              {t.title}
            </Link>
          ))}
        </div>
      )}

      {/* Пять вкладок на телефоне переносятся на вторую строку: лента с
          прокруткой прятала крайние вкладки, и подсказки, что они есть, не было */}
      <nav aria-label="Виды проекта" className="mb-4 flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-edge bg-surface p-1">
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
      </nav>

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
        {view === "plan" && (
          <div className="flex h-full min-h-0 flex-col">
            <nav aria-label="Режим плана" className="mb-3 flex flex-wrap gap-1">
              {PLAN_MODES.map((m) => (
                <Link
                  key={m.id}
                  href={`/projects/${project.id}?view=plan&plan=${m.id}`}
                  aria-current={plan === m.id ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    plan === m.id ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  {m.label}
                </Link>
              ))}
            </nav>
            <div className="min-h-0 flex-1">
              {plan === "gantt" && (
                <GanttChart tasks={tasks} projectKey={project.key} links={linkDtos} />
              )}
              {plan === "sprint" && (
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
              {plan === "graph" && (
                <TaskGraph
                  tasks={tasks}
                  links={linkDtos}
                  projectName={project.name}
                  projectKey={project.key}
                />
              )}
            </div>
          </div>
        )}
        {view === "stats" && (
          <div className="h-full space-y-4 overflow-y-auto pb-6 pr-1">
            <FlowPanel {...(await getFlow(project.id, project.key))} />
            <ProjectStats
              tasks={tasks}
              hoursByUser={await getHoursByUser(project.id)}
              completion={await getCompletionSeries(project.id)}
            />
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
          </div>
        )}
        {about && (
          <div className="h-full space-y-4 overflow-y-auto pb-6 pr-1">
            {project.description && (
              <Card>
                <SectionTitle className="mb-2">Описание</SectionTitle>
                <p className="max-w-3xl whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">
                  {project.description}
                </p>
              </Card>
            )}
            <Card as="section">
              <SectionTabs
                label="О проекте"
                tabs={[
                  {
                    id: "links",
                    label: "Материалы",
                    count: about.links.length,
                    content: (
                      <>
                        <p className="mb-4 text-sm text-muted">
                          Общие материалы проекта: документация, макеты, дашборды, регламенты.
                          Ссылки, привязанные к конкретным задачам, живут в самих задачах.
                        </p>
                        <ResourceLinks projectId={project.id} links={about.links} />
                      </>
                    ),
                  },
                  {
                    id: "polls",
                    label: "Опросы",
                    count: about.polls.length,
                    content: <PollsPanel projectId={project.id} polls={about.polls} />,
                  },
                  {
                    id: "activity",
                    label: "Активность",
                    content: <ActivityFeed items={about.activity} projectKey={project.key} />,
                  },
                ]}
              />
            </Card>
          </div>
        )}
      </div>

      <ProjectStatusBar
        projectId={project.id}
        open={open}
        total={tasks.length}
        overdue={overdue}
        spentHours={totalSpent}
        members={members.length}
        tags={projectTags.length}
      />
    </div>
  );
}
