import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { canAccessProject } from "@/lib/access";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  formatDate,
  formatHours,
} from "@/lib/labels";
import { PrintToolbar } from "@/components/PrintToolbar";

/**
 * Печатный отчёт по проекту. Светлая вёрстка под бумагу;
 * «Сохранить как PDF» — через системный диалог печати браузера.
 */
export default async function ProjectReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!(await canAccessProject(id, user))) notFound();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true } },
      tasks: {
        include: {
          assignees: { select: { name: true } },
          timeEntries: { include: { user: { select: { name: true } } } },
          checklist: { select: { done: true } },
        },
        orderBy: { number: "asc" },
      },
    },
  });
  if (!project) notFound();

  const spentTotal = project.tasks.reduce(
    (s, t) => s + t.timeEntries.reduce((x, e) => x + e.hours, 0),
    0
  );
  const estimateTotal = project.tasks.reduce((s, t) => s + (t.estimateHours ?? 0), 0);
  const doneCount = project.tasks.filter(
    (t) => t.status === "DONE" || t.status === "CLOSED"
  ).length;

  // Сводка часов по сотрудникам
  const byUser = new Map<string, number>();
  for (const t of project.tasks)
    for (const e of t.timeEntries)
      byUser.set(e.user.name, (byUser.get(e.user.name) ?? 0) + e.hours);

  const statuses = Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[];

  return (
    <div className="mx-auto max-w-4xl bg-white px-10 py-8 text-[13px] leading-relaxed text-slate-900 print:max-w-none print:px-0 print:py-0">
      <PrintToolbar backHref={`/projects/${project.id}`} />

      <header className="mb-6 border-b-2 border-slate-900 pb-4">
        <p className="font-mono text-xs tracking-widest text-slate-500">
          PATHLOGS · ОТЧЁТ ПО ПРОЕКТУ · {formatDate(new Date())}
        </p>
        <h1 className="mt-1 text-2xl font-bold">
          [{project.key}] {project.name}
        </h1>
        {project.description && (
          <p className="mt-1 text-slate-600">{project.description}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Владелец: {project.owner.name} · Создан: {formatDate(project.createdAt)}
          {project.status === "ARCHIVED" && " · В АРХИВЕ"}
        </p>
      </header>

      <section className="mb-6 grid grid-cols-4 gap-4">
        {[
          ["Всего задач", String(project.tasks.length)],
          ["Завершено", String(doneCount)],
          ["Оценка", formatHours(estimateTotal)],
          ["Потрачено", formatHours(spentTotal)],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-slate-300 p-3 text-center">
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          </div>
        ))}
      </section>

      {statuses.map((status) => {
        const tasks = project.tasks.filter((t) => t.status === status);
        if (tasks.length === 0) return null;
        return (
          <section key={status} className="mb-5 break-inside-avoid-page">
            <h2 className="mb-2 border-b border-slate-300 pb-1 text-sm font-bold uppercase tracking-wide">
              {STATUS_LABELS[status]} ({tasks.length})
            </h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-1 pr-2 font-semibold">Код</th>
                  <th className="py-1 pr-2 font-semibold">Задача</th>
                  <th className="py-1 pr-2 font-semibold">Тип</th>
                  <th className="py-1 pr-2 font-semibold">Приоритет</th>
                  <th className="py-1 pr-2 font-semibold">Исполнители</th>
                  <th className="py-1 pr-2 font-semibold">Срок</th>
                  <th className="py-1 pr-2 font-semibold">Чек-лист</th>
                  <th className="py-1 text-right font-semibold">Часы</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const spent = t.timeEntries.reduce((s, e) => s + e.hours, 0);
                  const checkDone = t.checklist.filter((i) => i.done).length;
                  return (
                    <tr key={t.id} className="border-t border-slate-200 align-top">
                      <td className="py-1.5 pr-2 font-mono text-xs whitespace-nowrap">
                        {project.key}-{t.number}
                      </td>
                      <td className="py-1.5 pr-2 font-medium">{t.title}</td>
                      <td className="py-1.5 pr-2">{TYPE_LABELS[t.type]}</td>
                      <td className="py-1.5 pr-2">{PRIORITY_LABELS[t.priority]}</td>
                      <td className="py-1.5 pr-2">
                        {t.assignees.map((a) => a.name).join(", ") || "—"}
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(t.dueDate)}</td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        {t.checklist.length ? `${checkDone}/${t.checklist.length}` : "—"}
                      </td>
                      <td className="py-1.5 text-right whitespace-nowrap">
                        {spent ? formatHours(spent) : "—"}
                        {t.estimateHours ? (
                          <span className="text-slate-400"> / {formatHours(t.estimateHours)}</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}

      {byUser.size > 0 && (
        <section className="mb-6 break-inside-avoid-page">
          <h2 className="mb-2 border-b border-slate-300 pb-1 text-sm font-bold uppercase tracking-wide">
            Трудозатраты по сотрудникам
          </h2>
          <table className="w-full max-w-md border-collapse">
            <tbody>
              {[...byUser.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([name, hours]) => (
                  <tr key={name} className="border-t border-slate-200">
                    <td className="py-1.5 pr-4">{name}</td>
                    <td className="py-1.5 text-right font-medium">{formatHours(hours)}</td>
                  </tr>
                ))}
              <tr className="border-t-2 border-slate-400 font-bold">
                <td className="py-1.5 pr-4">Итого</td>
                <td className="py-1.5 text-right">{formatHours(spentTotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <footer className="mt-8 border-t border-slate-300 pt-2 text-[10px] text-slate-400">
        Сформировано в PathLogs · {new Date().toLocaleString("ru-RU")}
      </footer>
    </div>
  );
}
