import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, initials } from "@/lib/labels";
import { UserRow } from "@/components/admin/UserRow";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: { assignedTasks: true, patchLogs: true, timeEntries: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const totals = await prisma.$transaction([
    prisma.project.count(),
    prisma.task.count(),
    prisma.patchLog.count(),
    prisma.timeEntry.aggregate({ _sum: { hours: true } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Администрирование</h1>
          <p className="mt-1 text-sm text-muted">Пользователи, роли и статистика системы</p>
        </div>
        <CreateUserDialog />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Проектов", value: totals[0] },
          { label: "Задач", value: totals[1] },
          { label: "Патч-логов", value: totals[2] },
          { label: "Часов учтено", value: Math.round(totals[3]._sum.hours ?? 0) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-edge bg-surface p-4">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-edge bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2/60 text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-3 font-medium">Пользователь</th>
              <th className="px-5 py-3 font-medium">Роль</th>
              <th className="px-5 py-3 font-medium">Ставка/ч</th>
              <th className="px-5 py-3 font-medium">Задач</th>
              <th className="px-5 py-3 font-medium">Патч-логов</th>
              <th className="px-5 py-3 font-medium">Регистрация</th>
              <th className="px-5 py-3 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={{
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  role: u.role,
                  active: u.active,
                  initials: initials(u.name),
                  createdAt: formatDate(u.createdAt),
                  taskCount: u._count.assignedTasks,
                  patchLogCount: u._count.patchLogs,
                  hourlyRate: u.hourlyRate,
                }}
                isSelf={u.id === session.user.id}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
