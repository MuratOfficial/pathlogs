import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, STATUS_COLORS, TYPE_LABELS, TYPE_COLORS, formatDate } from "@/lib/labels";
import type { TaskStatus } from "@prisma/client";

// Колонки роадмапа (ARCHIVED/CLOSED не показываем как отдельную фазу)
const PHASES: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];

async function getProject(token: string) {
  return prisma.project.findUnique({
    where: { publicToken: token },
    select: {
      key: true,
      name: true,
      description: true,
      tasks: {
        where: { status: { not: "ARCHIVED" } },
        select: { number: true, title: true, status: true, type: true, dueDate: true },
        orderBy: [{ status: "asc" }, { number: "asc" }],
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const project = await getProject(token);
  return { title: project ? `${project.name} — роадмап` : "Роадмап" };
}

export default async function PublicRoadmapPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const project = await getProject(token);
  if (!project) notFound();

  const done = project.tasks.filter(
    (t) => t.status === "DONE" || t.status === "CLOSED"
  ).length;
  const total = project.tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const byPhase = (status: TaskStatus) =>
    project.tasks.filter((t) =>
      status === "DONE"
        ? t.status === "DONE" || t.status === "CLOSED"
        : t.status === status
    );

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-8">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="rounded-md bg-accent/15 px-2 py-1 font-mono text-xs font-bold text-accent-hover">
            {project.key}
          </span>
          <span className="rounded-full border border-edge px-2 py-0.5 text-[11px] text-muted">
            публичный роадмап · только просмотр
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
        {project.description && (
          <p className="mt-2 max-w-2xl text-sm text-muted">{project.description}</p>
        )}
        <div className="mt-5 max-w-md">
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>
              {done} / {total} задач завершено
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PHASES.map((phase) => {
          const items = byPhase(phase);
          return (
            <section key={phase} className="rounded-2xl border border-edge bg-surface/60 p-3">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[phase] }}
                />
                <h2 className="text-sm font-semibold">{STATUS_LABELS[phase]}</h2>
                <span className="ml-auto text-xs text-muted">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-muted/60">—</p>
                ) : (
                  items.map((t) => (
                    <div
                      key={t.number}
                      className="rounded-xl border border-edge bg-surface p-3"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-muted">
                          {project.key}-{t.number}
                        </span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: `${TYPE_COLORS[t.type]}26`,
                            color: TYPE_COLORS[t.type],
                          }}
                        >
                          {TYPE_LABELS[t.type]}
                        </span>
                        {t.dueDate && (
                          <span className="ml-auto text-[10px] text-muted">
                            {formatDate(t.dueDate)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-snug">{t.title}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <footer className="mt-10 text-center text-xs text-muted">
        Сгенерировано в PathLogs
      </footer>
    </div>
  );
}
