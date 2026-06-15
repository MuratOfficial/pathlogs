import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { formatDate, initials } from "@/lib/labels";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { ImportTrelloDialog } from "@/components/ImportTrelloDialog";
import { ArchiveProjectButton } from "@/components/ArchiveProjectButton";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = await requireUser();
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  const hasSavedTrello = Boolean(
    await prisma.trelloCredential.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
  );

  const projects = await prisma.project.findMany({
    where: {
      status: showArchived ? "ARCHIVED" : "ACTIVE",
      // Не-админ видит только проекты, где он владелец или участник
      ...(user.role !== "ADMIN"
        ? {
            OR: [
              { ownerId: user.id },
              { members: { some: { userId: user.id } } },
            ],
          }
        : {}),
    },
    include: {
      owner: true,
      members: { include: { user: true } },
      _count: { select: { tasks: true } },
      tasks: {
        where: { status: { in: ["DONE", "CLOSED"] } },
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Проекты</h1>
          <p className="mt-1 text-sm text-muted">
            {showArchived ? "Архивные проекты" : "Активные проекты и их прогресс"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={showArchived ? "/dashboard" : "/dashboard?archived=1"}
            className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            {showArchived ? "← Активные" : "Архив"}
          </Link>
          <ImportTrelloDialog hasSaved={hasSavedTrello} />
          <NewProjectDialog />
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-edge bg-surface/50 p-16 text-center">
          <p className="text-lg font-medium">
            {showArchived ? "Архив пуст" : "Пока нет проектов"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {showArchived
              ? "Заархивированные проекты появятся здесь"
              : "Создайте первый проект, чтобы начать вести задачи"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p, i) => {
            const done = p.tasks.length;
            const total = p._count.tasks;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const canManage =
              user.role === "ADMIN" ||
              p.ownerId === user.id ||
              (user.role === "MANAGER" && p.members.some((m) => m.userId === user.id));
            return (
              <div
                key={p.id}
                style={{ animationDelay: `${Math.min(i, 9) * 0.05}s` }}
                className="hover-lift animate-fade-up group relative rounded-2xl border border-edge bg-surface p-5 hover:border-accent/50"
              >
                <Link href={`/projects/${p.id}`} className="absolute inset-0 z-0" />
                <div className="relative z-10 pointer-events-none">
                  <div className="mb-3 flex items-start justify-between">
                    <span className="rounded-md bg-accent/15 px-2 py-1 font-mono text-xs font-bold text-accent-hover">
                      {p.key}
                    </span>
                    {canManage && (
                      <span className="pointer-events-auto">
                        <ArchiveProjectButton
                          projectId={p.id}
                          archived={p.status === "ARCHIVED"}
                        />
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold group-hover:text-accent-hover">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>
                  )}

                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs text-muted">
                      <span>
                        {done} / {total} задач завершено
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {p.members.slice(0, 5).map((m) => (
                        <span
                          key={m.id}
                          title={m.user.name}
                          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-accent/25 text-[10px] font-bold text-accent-hover"
                        >
                          {initials(m.user.name)}
                        </span>
                      ))}
                      {p.members.length > 5 && (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-surface-2 text-[10px] text-muted">
                          +{p.members.length - 5}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted">{formatDate(p.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
