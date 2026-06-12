import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { formatDateTime } from "@/lib/labels";
import type { NotificationType } from "@prisma/client";

const TYPE_META: Record<NotificationType, { label: string; color: string }> = {
  ASSIGNED: { label: "Назначение", color: "#6366f1" },
  COMMENT: { label: "Комментарий", color: "#06b6d4" },
  PATCHLOG: { label: "Патч-лог", color: "#84cc16" },
  STATUS: { label: "Статус", color: "#c084fc" },
};

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Просмотр страницы помечает всё прочитанным; подсветка — по состоянию на момент загрузки
  if (notifications.some((n) => !n.read)) {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-xl font-bold tracking-tight">Уведомления</h1>

      {notifications.length === 0 ? (
        <p className="rounded-2xl border border-edge bg-surface p-6 text-sm text-muted">
          Уведомлений пока нет. Они появятся, когда вас назначат на задачу или
          прокомментируют вашу.
        </p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const meta = TYPE_META[n.type];
            const inner = (
              <div
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                  n.read
                    ? "border-edge bg-surface"
                    : "border-accent/40 bg-accent/10"
                } ${n.taskId ? "hover:border-accent/60" : ""}`}
              >
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground/90">{n.message}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {meta.label} · {formatDateTime(n.createdAt)}
                  </p>
                </div>
                {!n.read && (
                  <span className="mt-1 shrink-0 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-hover">
                    новое
                  </span>
                )}
              </div>
            );
            return (
              <li key={n.id}>
                {n.taskId ? <Link href={`/tasks/${n.taskId}`}>{inner}</Link> : inner}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
