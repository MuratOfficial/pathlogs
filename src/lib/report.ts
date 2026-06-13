import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, formatHours } from "@/lib/labels";
import type { TaskStatus } from "@prisma/client";

const WEEK = 7 * 86400000;

/** Собирает недельный HTML-отчёт по проекту. null — если активности нет смысла слать. */
export async function buildWeeklyReport(projectId: string) {
  const since = new Date(Date.now() - WEEK);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { include: { user: { select: { email: true } } } },
      owner: { select: { email: true } },
      tasks: {
        include: { timeEntries: { where: { date: { gte: since } }, select: { hours: true } } },
      },
    },
  });
  if (!project) return null;

  const created = project.tasks.filter((t) => t.createdAt >= since);
  const closed = project.tasks.filter((t) => t.closedAt && t.closedAt >= since);
  const open = project.tasks.filter(
    (t) => t.status !== "DONE" && t.status !== "CLOSED" && t.status !== "ARCHIVED"
  );
  const overdue = open.filter((t) => t.dueDate && t.dueDate < new Date());
  const hoursWeek = project.tasks.reduce(
    (s, t) => s + t.timeEntries.reduce((x, e) => x + e.hours, 0),
    0
  );

  const byStatus = new Map<TaskStatus, number>();
  for (const t of open) byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1);

  const recipients = [
    project.owner.email,
    ...project.members.map((m) => m.user.email),
  ].filter((e, i, a) => a.indexOf(e) === i);

  const row = (label: string, value: string | number) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${label}</td><td style="padding:4px 0;font-weight:600">${value}</td></tr>`;

  const statusRows = [...byStatus.entries()]
    .map(([s, n]) => `<li>${STATUS_LABELS[s]}: <b>${n}</b></li>`)
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">Недельный отчёт · [${project.key}] ${project.name}</h2>
      <p style="color:#64748b;margin:0 0 16px">${new Date(Date.now() - WEEK).toLocaleDateString("ru-RU")} — ${new Date().toLocaleDateString("ru-RU")}</p>
      <table style="border-collapse:collapse;font-size:14px">
        ${row("Создано задач", created.length)}
        ${row("Закрыто задач", closed.length)}
        ${row("Открыто сейчас", open.length)}
        ${row("Просрочено", overdue.length)}
        ${row("Списано часов за неделю", formatHours(hoursWeek))}
      </table>
      ${statusRows ? `<h3 style="margin:16px 0 4px;font-size:14px">Открытые по статусам</h3><ul style="margin:0;padding-left:18px;font-size:14px">${statusRows}</ul>` : ""}
      <p style="color:#94a3b8;font-size:12px;margin-top:20px">Сформировано PathLogs</p>
    </div>`;

  return {
    subject: `PathLogs · ${project.key}: +${created.length} / −${closed.length} за неделю`,
    html,
    recipients,
    summary: {
      project: project.key,
      created: created.length,
      closed: closed.length,
      open: open.length,
      overdue: overdue.length,
      hoursWeek,
    },
  };
}
