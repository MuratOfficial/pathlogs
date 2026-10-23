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
import { TypeBadge, PriorityBadge, TagChip } from "@/components/TaskBadges";
import { TaskMetaPanel } from "@/components/task/TaskMetaPanel";
import { TaskDoneButton } from "@/components/task/TaskDoneButton";
import { ProjectBackdrop } from "@/components/ProjectBackdrop";
import { BackButton } from "@/components/BackButton";
import { getProjectBackground } from "@/lib/appearance";
import { TaskTags } from "@/components/task/TaskTags";
import { MoreMenu } from "@/components/MoreMenu";
import { SectionTabs } from "@/components/ui/SectionTabs";
import { EditableText } from "@/components/task/EditableText";
import { PatchLogForm } from "@/components/task/PatchLogForm";
import { TimeEntryForm } from "@/components/task/TimeEntryForm";
import { TaskStatusTimeline } from "@/components/task/TaskStatusTimeline";
import { GitCommits } from "@/components/task/GitCommits";
import { TaskAttachments } from "@/components/task/TaskAttachments";
import { DescriptionEditor } from "@/components/task/DescriptionEditor";
import { AddLinkForm } from "@/components/task/AddLinkForm";
import { ConfirmActionButton } from "@/components/task/ConfirmActionButton";
import { Checklist } from "@/components/task/Checklist";
import { CommentForm } from "@/components/task/CommentForm";
import { CommentThreads } from "@/components/task/CommentThreads";
import { Markdown } from "@toimetdev/pathlogs-core";
import { ResourceLinks } from "@/components/ResourceLinks";
import { getResourceLinks } from "@/lib/links";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { SubProjects } from "@/components/task/SubProjects";
import { getAttachableProjects, getSubProjects } from "@/lib/subprojects";
import { googleCalendarUrl } from "@/lib/calendar";
import { stripFileEmbeds } from "@/lib/attachments";
import {
  deletePatchLogAction,
  deleteTimeEntryAction,
  removeTaskLinkAction,
  deleteTaskAction,
  updateTaskFieldsAction,
} from "@/lib/actions/tasks";
import { canAccessProject, canManageProject } from "@/lib/access";
import type { AttachmentDTO } from "@/lib/types";
import { Card, SectionTitle } from "@/components/ui/Card";

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
      tags: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
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
      comments: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
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

  // Метки проекта — для панели меток в сайдбаре
  const projectTags = await prisma.tag.findMany({
    where: { projectId: task.projectId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
  const canManageTags = await canManageProject(task.projectId, user);

  // Проекты, привязанные к задаче как подзадачи, и что ещё можно привязать
  const subProjects = await getSubProjects(task.id);
  const attachableProjects = await getAttachableProjects(task.id, task.projectId, user);

  // Полезные ссылки задачи (блок «Ссылки»)
  const resourceLinks = await getResourceLinks(task.projectId, user, task.id);

  // Фон проекта — персональный, как и на самой странице проекта
  const background = await getProjectBackground(task.projectId, user.id);

  // История статусов (машина времени)
  const statusEvents = (
    await prisma.taskStatusEvent.findMany({
      where: { taskId: id },
      orderBy: { at: "asc" },
      select: { id: true, toStatus: true, at: true, user: { select: { name: true } } },
    })
  ).map((e) => ({ id: e.id, toStatus: e.toStatus, at: e.at, actor: e.user?.name ?? null }));

  // Git-коммиты задачи
  const commits = await prisma.gitCommitRef.findMany({
    where: { taskId: id },
    orderBy: [{ committedAt: "desc" }, { createdAt: "desc" }],
    take: 20,
    select: {
      id: true,
      sha: true,
      message: true,
      url: true,
      author: true,
      filesChanged: true,
      committedAt: true,
      createdAt: true,
    },
  });

  // Вложения для клиентских блоков: и для плиток с превью, и для вставок
  // в описании. canDelete считаем здесь — на клиенте роли нет.
  const attachments: AttachmentDTO[] = task.attachments.map((a) => ({
    id: a.id,
    taskId: a.taskId,
    filename: a.filename,
    url: a.url,
    mime: a.mime,
    size: a.size,
    storage: a.storage,
    createdAt: a.createdAt.toISOString(),
    uploadedBy: { id: a.uploadedById, name: a.uploadedBy.name },
    canDelete: a.uploadedById === user.id || user.role === "ADMIN",
  }));

  // Ссылка «в Google Calendar» — только если у задачи есть даты
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const gcalUrl = googleCalendarUrl({
    title: `${task.project.key}-${task.number}: ${task.title}`,
    // В ссылке на календарь показать вложение нечем — вставки убираем
    details: stripFileEmbeds(task.description ?? ""),
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

  const menuItemCls =
    "block rounded-lg px-3 py-2 text-sm text-foreground/90 transition hover:bg-surface-2";

  return (
    <div className="mx-auto max-w-full">
      <ProjectBackdrop background={background} />

      {/* Хлебные крошки */}
      <div className="mb-4 flex items-center gap-2 text-sm text-muted">
        <BackButton className="mr-1" />
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

      {/* Разделы сгруппированы по смыслу — по пять в колонке задачи и по три
          в боковой. Пустые разделы прячутся во вкладках, а не стоят отдельными
          карточками с нулём, поэтому липкая навигация по странице не нужна. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* ОСНОВНАЯ КОЛОНКА */}
        <div className="min-w-0 space-y-6">
          <Card id="task-overview">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <TypeBadge type={task.type} />
              <PriorityBadge priority={task.priority} />
              <span
                className="rounded px-2 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: STATUS_COLORS[task.status] + "26",
                  color: STATUS_COLORS[task.status],
                }}
              >
                {STATUS_LABELS[task.status]}
              </span>
              {task.tags.length > 0 && (
                <span className="flex flex-wrap items-center gap-1.5">
                  {task.tags.map((t) => (
                    <TagChip key={t.id} tag={t} />
                  ))}
                </span>
              )}
              {/* Отметить выполненной прямо здесь — не открывая «Параметры».
                  Выгрузка в календарь — рядом, в меню: две ссылки не стоят
                  отдельной карточки */}
              <span className="ml-auto flex items-center gap-2">
                {gcalUrl && (
                  <MoreMenu label="Календарь">
                    <a href={gcalUrl} target="_blank" rel="noopener noreferrer" className={menuItemCls}>
                      В Google Calendar
                    </a>
                    <a href={`/api/tasks/${task.id}/ics`} className={menuItemCls}>
                      Скачать .ics (Outlook / Apple)
                    </a>
                  </MoreMenu>
                )}
                <TaskDoneButton taskId={task.id} status={task.status} />
              </span>
            </div>
            <EditableText
              value={task.title}
              big
              onSave={updateTaskFieldsAction.bind(null, task.id)}
              field="title"
            />
            <div className="mt-4">
              <SectionTitle as="h3" className="mb-2">
                Описание
              </SectionTitle>
              <DescriptionEditor
                taskId={task.id}
                value={task.description ?? ""}
                attachments={attachments}
                onSave={updateTaskFieldsAction.bind(null, task.id)}
              />
            </div>
          </Card>

          {/* Состав: из чего задача складывается — пункты, ветки, проекты */}
          <Card as="section" id="task-structure">
            <SectionTitle className="mb-4">
              Чек-лист ({task.checklist.filter((i) => i.done).length}/{task.checklist.length})
            </SectionTitle>
            <Checklist
              taskId={task.id}
              items={task.checklist.map((i) => ({ id: i.id, text: i.text, done: i.done }))}
            />

            <div className="mt-5 border-t border-edge pt-5">
              <div className="mb-4 flex items-center justify-between">
                <SectionTitle>
                  Подзадачи · ветки ({task.children.length})
                </SectionTitle>
                <NewTaskDialog
                  projectId={task.projectId}
                  tasks={[{ id: task.id, number: task.number, title: task.title }, ...projectTasks]}
                  members={projectMembers}
                  projectTags={projectTags}
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
                              data-tip={a.name}
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
            </div>

            {/* Проекты-подзадачи: ветка, выросшая до отдельного проекта */}
            <div className="mt-5 border-t border-edge pt-5">
              <SectionTitle as="h3" className="mb-3">
                Проекты ({subProjects.length})
              </SectionTitle>
              <SubProjects
                taskId={task.id}
                projects={subProjects}
                attachable={attachableProjects}
              />
            </div>
          </Card>

          {/* Обсуждение */}
          <Card as="section" id="task-comments">
            <SectionTitle className="mb-4">
              Обсуждение ({task.comments.length})
            </SectionTitle>
            <CommentThreads
              taskId={task.id}
              comments={task.comments.map((c) => ({
                id: c.id,
                parentId: c.parentId,
                content: c.content,
                createdAt: c.createdAt.toISOString(),
                authorId: c.authorId,
                authorName: c.author.name,
              }))}
              members={projectMembers}
              currentUserId={user.id}
              canModerate={user.role === "ADMIN"}
            />
            <CommentForm taskId={task.id} members={projectMembers} />
          </Card>

          {/* Хронология: что сделано (патч-лог), как двигался статус, какие
              коммиты пришли из git — три истории одной задачи в одной карточке */}
          <Card as="section" id="task-history">
            <SectionTabs
              label="Хронология"
              tabs={[
                {
                  id: "patchlog",
                  label: "Патч-лог",
                  count: task.patchLogs.length,
                  content: (
                    <>
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
                    </>
                  ),
                },
                {
                  id: "statuses",
                  label: "Статусы",
                  count: statusEvents.length,
                  content: <TaskStatusTimeline events={statusEvents} />,
                },
                ...(commits.length > 0
                  ? [
                      {
                        id: "commits",
                        label: "Коммиты",
                        count: commits.length,
                        content: <GitCommits commits={commits} />,
                      },
                    ]
                  : []),
              ]}
            />
          </Card>

          {/* Материалы: ссылки и файлы задачи */}
          <Card as="section" id="task-materials">
            <SectionTabs
              label="Материалы"
              tabs={[
                {
                  id: "links",
                  label: "Ссылки",
                  count: resourceLinks.length,
                  content: (
                    <ResourceLinks
                      projectId={task.projectId}
                      taskId={task.id}
                      links={resourceLinks}
                      emptyHint="Ссылок пока нет — добавьте макет, тикет, спеку или пул-реквест."
                    />
                  ),
                },
                {
                  id: "files",
                  label: "Файлы",
                  count: task.attachments.length,
                  content: (
                    <>
                      <TaskAttachments taskId={task.id} attachments={attachments} />
                      {attachments.length === 0 && (
                        <p className="mt-3 text-sm text-muted">
                          Файлов пока нет — приложите макет, скриншот или документ.
                        </p>
                      )}
                    </>
                  ),
                },
              ]}
            />
          </Card>
        </div>

        {/* САЙДБАР */}
        <div className="space-y-6">
          {/* Поля задачи; в той же карточке — метки и сведения о задаче */}
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
          >
            <div className="mt-5 border-t border-edge pt-5">
              <TaskTags
                taskId={task.id}
                projectId={task.projectId}
                tags={task.tags}
                projectTags={projectTags}
                canManage={canManageTags}
              />
            </div>
            <div className="mt-5 border-t border-edge pt-4 text-xs text-muted">
              <p className="mb-1">
                Создал: <span className="text-foreground">{task.creator.name}</span>
              </p>
              <p className="mb-1">Создана: {formatDateTime(task.createdAt)}</p>
              <p className="mb-1">Обновлена: {formatDateTime(task.updatedAt)}</p>
              {task.closedAt && <p>Закрыта: {formatDateTime(task.closedAt)}</p>}
              {canDeleteTask && (
                <div className="mt-3">
                  <ConfirmActionButton
                    action={deleteTaskAction.bind(null, task.id)}
                    confirmTitle={`Удалить задачу ${task.project.key}-${task.number}?`}
                    confirmText="Вместе с задачей будут удалены её патч-логи, комментарии, файлы и записи времени. Действие необратимо."
                    label="Удалить задачу"
                    redirectTo={`/projects/${task.projectId}`}
                  />
                </div>
              )}
            </div>
          </TaskMetaPanel>

          {/* Трудозатраты */}
          <Card as="section" id="task-time">
            <SectionTitle className="mb-3">
              Трудозатраты
            </SectionTitle>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{formatHours(spent)}</span>
              {task.estimateHours && (
                <span className="text-sm text-muted">из {formatHours(task.estimateHours)}</span>
              )}
            </div>
            {task.estimateHours && (
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${spent > task.estimateHours ? "bg-danger" : "bg-success"}`}
                  style={{ width: `${Math.min(100, (spent / task.estimateHours) * 100)}%` }}
                />
              </div>
            )}
            <TimeEntryForm taskId={task.id} />
            {task.timeEntries.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-edge pt-4">
                {task.timeEntries.slice(0, 8).map((e) => (
                  <li
                    key={e.id}
                    className="rounded-xl border border-edge bg-surface-2/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="shrink-0 font-semibold text-foreground">
                        {formatHours(e.hours)}
                      </span>
                      <span className="min-w-0 truncate text-muted">{e.user.name}</span>
                      <span className="ml-auto shrink-0 text-muted">{formatDate(e.date)}</span>
                      {(e.userId === user.id || user.role === "ADMIN") && (
                        <ConfirmActionButton
                          action={deleteTimeEntryAction.bind(null, e.id)}
                          confirmText="Удалить запись времени?"
                          small
                        />
                      )}
                    </div>
                    {/* Комментарий — отдельной строкой с переносами: длинный
                        текст читается целиком и не ломает вёрстку строки. */}
                    {e.note && (
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">
                        {e.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {task.timeEntries.length > 8 && (
              <p className="mt-2 text-center text-[11px] text-muted">
                показаны последние 8 из {task.timeEntries.length}
              </p>
            )}
          </Card>

          {/* Связи */}
          <Card as="section" id="task-relations">
            <SectionTitle className="mb-3">
              Связи
            </SectionTitle>
            <AddLinkForm taskId={task.id} tasks={projectTasks} />
            <ul className="mt-3 space-y-1.5">
              {task.linksFrom.map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-xs">
                  <span className="shrink-0 rounded bg-danger/15 px-1.5 py-0.5 text-[10px] text-danger-text">
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
          </Card>
        </div>
      </div>
    </div>
  );
}
