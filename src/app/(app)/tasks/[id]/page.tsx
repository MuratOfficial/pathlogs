import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  formatDate,
  formatDateTime,
  formatHours,
  initials,
} from "@/lib/labels";
import { TypeBadge, PriorityDot } from "@/components/TaskBadges";
import { TaskMetaPanel } from "@/components/task/TaskMetaPanel";
import { EditableText } from "@/components/task/EditableText";
import { PatchLogForm } from "@/components/task/PatchLogForm";
import { TimeEntryForm } from "@/components/task/TimeEntryForm";
import { FileUpload } from "@/components/task/FileUpload";
import { AddLinkForm } from "@/components/task/AddLinkForm";
import { ConfirmActionButton } from "@/components/task/ConfirmActionButton";
import { Checklist } from "@/components/task/Checklist";
import { Markdown } from "@/components/Markdown";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { googleCalendarUrl } from "@/lib/calendar";
import {
  deletePatchLogAction,
  deleteTimeEntryAction,
  deleteAttachmentAction,
  removeTaskLinkAction,
  deleteTaskAction,
  updateTaskFieldsAction,
} from "@/lib/actions/tasks";
import { canAccessProject } from "@/lib/access";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      project: {
        select: {
          id: true,
          key: true,
          name: true,
          owner: { select: { id: true, name: true } },
          members: { select: { user: { select: { id: true, name: true } } } },
        },
      },
      parent: { select: { id: true, number: true, title: true } },
      children: {
        include: { assignees: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      creator: { select: { id: true, name: true } },
      assignees: { select: { id: true, name: true } },
      patchLogs: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      timeEntries: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { date: "desc" },
      },
      attachments: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      checklist: { orderBy: { order: "asc" } },
      linksFrom: { include: { to: { select: { id: true, number: true, title: true } } } },
      linksTo: { include: { from: { select: { id: true, number: true, title: true } } } },
    },
  });
  if (!task) notFound();

  // Чужая задача неотличима от несуществующей
  if (!(await canAccessProject(task.projectId, user))) notFound();

  const projectTasks = await prisma.task.findMany({
    where: { projectId: task.projectId, id: { not: task.id } },
    select: { id: true, number: true, title: true },
    orderBy: { number: "asc" },
  });
  // Исполнители выбираются из участников проекта
  const memberUsers = task.project.members.map((m) => m.user);
  const projectMembers = memberUsers.some((u) => u.id === task.project.owner.id)
    ? memberUsers
    : [task.project.owner, ...memberUsers];

  const spent = task.timeEntries.reduce((s, e) => s + e.hours, 0);

  // Ссылка «в Google Calendar» — только если у задачи есть даты
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const gcalUrl = googleCalendarUrl({
    title: `${task.project.key}-${task.number}: ${task.title}`,
    details: task.description ?? "",
    start: task.startDate,
    due: task.dueDate,
    url: `${origin}/tasks/${task.id}`,
  });

  // Право удаления: автор задачи, владелец проекта, менеджер или админ
  const canDeleteTask =
    task.creatorId === user.id ||
    task.project.owner.id === user.id ||
    user.role === "ADMIN" ||
    user.role === "MANAGER";

  return (
    <div className="mx-auto max-w-6xl">
      {/* Хлебные крошки */}
      <div className="mb-4 flex items-center gap-2 text-sm text-muted">
        <Link href="/dashboard" className="hover:text-foreground">Проекты</Link>
        <span>/</span>
        <Link href={`/projects/${task.project.id}`} className="hover:text-foreground">
          {task.project.name}
        </Link>
        {task.parent && (
          <>
            <span>/</span>
            <Link href={`/tasks/${task.parent.id}`} className="hover:text-foreground">
              {task.project.key}-{task.parent.number}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="font-mono font-semibold text-foreground">
          {task.project.key}-{task.number}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* ОСНОВНАЯ КОЛОНКА */}
        <div className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-edge bg-surface p-6">
            <div className="mb-3 flex items-center gap-3">
              <TypeBadge type={task.type} />
              <PriorityDot priority={task.priority} />
              <span
                className="rounded px-2 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: STATUS_COLORS[task.status] + "26",
                  color: STATUS_COLORS[task.status],
                }}
              >
                {STATUS_LABELS[task.status]}
              </span>
            </div>
            <EditableText
              value={task.title}
              big
              onSave={updateTaskFieldsAction.bind(null, task.id)}
              field="title"
            />
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Описание
              </h3>
              <EditableText
                value={task.description ?? ""}
                multiline
                markdown
                placeholder="Добавьте описание… (поддерживается markdown)"
                onSave={updateTaskFieldsAction.bind(null, task.id)}
                field="description"
              />
            </div>
          </div>

          {/* Чек-лист */}
          <section className="rounded-2xl border border-edge bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
              Чек-лист (
              {task.checklist.filter((i) => i.done).length}/{task.checklist.length})
            </h2>
            <Checklist
              taskId={task.id}
              items={task.checklist.map((i) => ({ id: i.id, text: i.text, done: i.done }))}
            />
          </section>

          {/* Подзадачи */}
          <section className="rounded-2xl border border-edge bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Подзадачи · ветки ({task.children.length})
              </h2>
              <NewTaskDialog
                projectId={task.projectId}
                tasks={[{ id: task.id, number: task.number, title: task.title }, ...projectTasks]}
                members={projectMembers}
                defaultParentId={task.id}
                triggerLabel="+ Подзадача"
                triggerClassName="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
              />
            </div>
            {task.children.length === 0 ? (
              <p className="text-sm text-muted">Подзадач пока нет — создайте ветку</p>
            ) : (
              <ul className="space-y-2">
                {task.children.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/tasks/${c.id}`}
                      className="flex items-center gap-3 rounded-xl border border-edge bg-surface-2/50 px-4 py-2.5 transition hover:border-accent/50"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[c.status] }}
                      />
                      <span className="font-mono text-xs text-muted">
                        {task.project.key}-{c.number}
                      </span>
                      <span className="text-sm font-medium">{c.title}</span>
                      <span className="ml-auto flex -space-x-1.5">
                        {c.assignees.slice(0, 3).map((a) => (
                          <span
                            key={a.id}
                            title={a.name}
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-surface bg-accent/25 text-[9px] font-bold text-accent-hover"
                          >
                            {initials(a.name)}
                          </span>
                        ))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Патч-лог */}
          <section className="rounded-2xl border border-edge bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
              Патч-лог · история реализации ({task.patchLogs.length})
            </h2>
            <PatchLogForm taskId={task.id} />
            <div className="mt-5 space-y-4">
              {task.patchLogs.map((log) => (
                <article
                  key={log.id}
                  className="relative rounded-xl border border-edge bg-surface-2/50 p-4 pl-5"
                >
                  <span className="absolute inset-y-3 left-0 w-1 rounded-full bg-accent/60" />
                  <div className="mb-1.5 flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{log.title}</h3>
                    <span className="ml-auto text-xs text-muted">
                      {formatDateTime(log.createdAt)}
                    </span>
                    {(log.authorId === user.id || user.role === "ADMIN") && (
                      <ConfirmActionButton
                        action={deletePatchLogAction.bind(null, log.id)}
                        confirmText="Удалить запись патч-лога?"
                      />
                    )}
                  </div>
                  <Markdown text={log.content} />
                  <p className="mt-2 text-xs text-muted">— {log.author.name}</p>
                </article>
              ))}
              {task.patchLogs.length === 0 && (
                <p className="text-sm text-muted">
                  Записей нет. Фиксируйте здесь, что и как было реализовано.
                </p>
              )}
            </div>
          </section>

          {/* Файлы */}
          <section className="rounded-2xl border border-edge bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
              Файлы ({task.attachments.length})
            </h2>
            <FileUpload taskId={task.id} />
            {task.attachments.length > 0 && (
              <ul className="mt-4 space-y-2">
                {task.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-edge bg-surface-2/50 px-4 py-2.5"
                  >
                    <svg className="h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                    </svg>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent-hover"
                    >
                      {a.filename}
                    </a>
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                      {a.storage === "S3" ? "S3" : "локально"}
                    </span>
                    <span className="text-xs text-muted">{(a.size / 1024).toFixed(0)} КБ</span>
                    {(a.uploadedById === user.id || user.role === "ADMIN") && (
                      <ConfirmActionButton
                        action={deleteAttachmentAction.bind(null, a.id)}
                        confirmText="Удалить файл?"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* САЙДБАР */}
        <div className="space-y-6">
          <TaskMetaPanel
            task={{
              id: task.id,
              status: task.status,
              type: task.type,
              priority: task.priority,
              estimateHours: task.estimateHours,
              startDate: task.startDate?.toISOString().slice(0, 10) ?? null,
              dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
              assigneeIds: task.assignees.map((a) => a.id),
            }}
            users={projectMembers}
          />

          {/* Трудозатраты */}
          <section className="rounded-2xl border border-edge bg-surface p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Трудозатраты
            </h2>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{formatHours(spent)}</span>
              {task.estimateHours && (
                <span className="text-sm text-muted">из {formatHours(task.estimateHours)}</span>
              )}
            </div>
            {task.estimateHours && (
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${spent > task.estimateHours ? "bg-red-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, (spent / task.estimateHours) * 100)}%` }}
                />
              </div>
            )}
            <TimeEntryForm taskId={task.id} />
            <ul className="mt-4 space-y-2">
              {task.timeEntries.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-foreground">{formatHours(e.hours)}</span>
                  <span className="truncate text-muted">
                    {e.user.name}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                  <span className="ml-auto shrink-0 text-muted">{formatDate(e.date)}</span>
                  {(e.userId === user.id || user.role === "ADMIN") && (
                    <ConfirmActionButton
                      action={deleteTimeEntryAction.bind(null, e.id)}
                      confirmText="Удалить запись времени?"
                      small
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Календарь */}
          {gcalUrl && (
            <section className="rounded-2xl border border-edge bg-surface p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Календарь
              </h2>
              <div className="flex flex-col gap-2">
                <a
                  href={gcalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-edge px-3 py-2 text-sm font-medium transition hover:border-accent/50 hover:bg-surface-2"
                >
                  <svg className="h-4 w-4 shrink-0 text-accent-hover" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                  </svg>
                  В Google Calendar
                </a>
                <a
                  href={`/api/tasks/${task.id}/ics`}
                  className="flex items-center gap-2 rounded-lg border border-edge px-3 py-2 text-sm font-medium transition hover:border-accent/50 hover:bg-surface-2"
                >
                  <svg className="h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Скачать .ics (Outlook / Apple)
                </a>
              </div>
            </section>
          )}

          {/* Связи */}
          <section className="rounded-2xl border border-edge bg-surface p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              Связи
            </h2>
            <AddLinkForm taskId={task.id} tasks={projectTasks} />
            <ul className="mt-3 space-y-1.5">
              {task.linksFrom.map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-xs">
                  <span className="shrink-0 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
                    {l.type === "BLOCKS" ? "блокирует" : l.type === "RELATES" ? "связана с" : "дублирует"}
                  </span>
                  <Link href={`/tasks/${l.to.id}`} className="truncate hover:text-accent-hover">
                    #{l.to.number} {l.to.title}
                  </Link>
                  <ConfirmActionButton
                    action={removeTaskLinkAction.bind(null, l.id)}
                    confirmText="Удалить связь?"
                    small
                  />
                </li>
              ))}
              {task.linksTo.map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-xs">
                  <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                    {l.type === "BLOCKS" ? "заблокирована" : l.type === "RELATES" ? "связана с" : "дубликат"}
                  </span>
                  <Link href={`/tasks/${l.from.id}`} className="truncate hover:text-accent-hover">
                    #{l.from.number} {l.from.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Информация */}
          <section className="rounded-2xl border border-edge bg-surface p-5 text-xs text-muted">
            <p className="mb-1">
              Создал: <span className="text-foreground">{task.creator.name}</span>
            </p>
            <p className="mb-1">Создана: {formatDateTime(task.createdAt)}</p>
            <p className="mb-1">Обновлена: {formatDateTime(task.updatedAt)}</p>
            {task.closedAt && <p>Закрыта: {formatDateTime(task.closedAt)}</p>}
            {canDeleteTask && (
              <div className="mt-4 border-t border-edge pt-3">
                <ConfirmActionButton
                  action={deleteTaskAction.bind(null, task.id)}
                  confirmText="Удалить задачу со всеми патч-логами и записями времени?"
                  label="Удалить задачу"
                  redirectTo={`/projects/${task.projectId}`}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
