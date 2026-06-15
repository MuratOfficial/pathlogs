import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { ROLE_LABELS, formatDate, formatDateTime, formatHours, initials } from "@/lib/labels";
import { ProfileNameForm, PasswordForm } from "@/components/ProfileForms";
import { ApiTokens } from "@/components/ApiTokens";
import { TrelloConnection } from "@/components/TrelloConnection";

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    include: {
      _count: { select: { assignedTasks: true, createdTasks: true, patchLogs: true } },
    },
  });
  const spent = await prisma.timeEntry.aggregate({
    where: { userId: user.id },
    _sum: { hours: true },
  });
  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  const trelloConnected = Boolean(
    await prisma.trelloCredential.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-lg font-bold text-accent-hover">
          {initials(user.name)}
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted">
            {user.email} · {ROLE_LABELS[user.role]} · с {formatDate(user.createdAt)}
            {user.hourlyRate != null && ` · ставка ${user.hourlyRate}/ч`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Назначено задач", String(user._count.assignedTasks)],
          ["Создано задач", String(user._count.createdTasks)],
          ["Патч-логов", String(user._count.patchLogs)],
          ["Часов списано", formatHours(spent._sum.hours ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-edge bg-surface p-4 text-center">
            <p className="text-xl font-bold">{value}</p>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-muted">{label}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-edge bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Данные
        </h2>
        <ProfileNameForm name={user.name} />
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          {user.passwordHash ? "Смена пароля" : "Установка пароля"}
        </h2>
        <PasswordForm hasPassword={Boolean(user.passwordHash)} />
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
          API-токены
        </h2>
        <p className="mb-4 text-xs text-muted">
          Для git-вебхука и интеграций. Передавайте в заголовке{" "}
          <code className="rounded bg-surface-2 px-1">Authorization: Bearer …</code>
        </p>
        <ApiTokens
          tokens={tokens.map((t) => ({
            id: t.id,
            name: t.name,
            prefix: t.prefix,
            lastUsedAt: t.lastUsedAt ? formatDateTime(t.lastUsedAt) : null,
            createdAt: formatDate(t.createdAt),
          }))}
        />
      </section>

      <section className="rounded-2xl border border-edge bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Интеграция с Trello
        </h2>
        <TrelloConnection connected={trelloConnected} />
      </section>
    </div>
  );
}
