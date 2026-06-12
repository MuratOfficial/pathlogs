import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import type { TaskDTO, LinkDTO, MemberDTO, ColumnDTO } from "@/lib/types";
import { ensureDefaultColumns } from "@/lib/board";
import { canAccessProject, canManageProject } from "@/lib/access";
import { ProjectMembersDialog } from "@/components/ProjectMembersDialog";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TaskGraph } from "@/components/TaskGraph";
import { TaskListView } from "@/components/TaskListView";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { ArchiveProjectButton } from "@/components/ArchiveProjectButton";
import { formatHours } from "@/lib/labels";

const VIEWS = [
  { id: "board", label: "Канбан" },
  { id: "graph", label: "Граф веток" },
  { id: "list", label: "Список" },
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
    },
  });
  if (!project) notFound();

  const links = await prisma.taskLink.findMany({
    where: { from: { projectId: id } },
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
    <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-[1600px] flex-col">
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

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-4 text-xs text-muted md:flex">
            <span>Открыто: <b className="text-foreground">{open}</b></span>
            <span>Всего: <b className="text-foreground">{tasks.length}</b></span>
            <span>Затрачено: <b className="text-foreground">{formatHours(totalSpent)}</b></span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={`/api/projects/${project.id}/export`}
              title="Выгрузить задачи и трудозатраты в Excel"
              className="rounded-lg border border-edge px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
            >
              XLSX
            </a>
            <Link
              href={`/projects/${project.id}/report`}
              title="Печатный отчёт — сохраните как PDF"
              className="rounded-lg border border-edge px-3 py-2 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
            >
              PDF-отчёт
            </Link>
          </div>
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
          />
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl border border-edge bg-surface p-1 w-fit">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={`/projects/${project.id}?view=${v.id}`}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              view === v.id
                ? "bg-accent text-white"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <div className="min-h-0 flex-1">
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
          <TaskListView tasks={tasks} projectKey={project.key} members={members} />
        )}
      </div>
    </div>
  );
}
