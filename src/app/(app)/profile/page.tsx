import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { ROLE_LABELS, formatDate, formatDateTime, formatHours, initials } from "@/lib/labels";
import { ProfileNameForm, PasswordForm } from "@/components/ProfileForms";
import { ApiTokens } from "@/components/ApiTokens";
import { TrelloConnection } from "@/components/TrelloConnection";
import { ContributionCalendar } from "@/components/ContributionCalendar";
import { getContributions } from "@/lib/contributions";
import { Card, SectionTitle } from "@/components/ui/Card";

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
  const contributions = await getContributions(user.id);
  const trelloConnected = Boolean(
    await prisma.trelloCredential.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
  );

  return (
    <div className="mx-auto max-w-full space-y-6">
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
          <Card key={label} className="text-center">
            <p className="text-xl font-bold">{value}</p>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-muted">{label}</p>
          </Card>
        ))}
      </div>

      <Card as="section">
        <SectionTitle className="mb-1">
          Активность за год
        </SectionTitle>
        <p className="mb-4 text-xs text-muted">
          Патч-логи, комментарии, созданные задачи, списанное время и переводы
          статуса — всё, что и так записывается, просто собрано по дням.
        </p>
        <ContributionCalendar
          values={contributions.values}
          from={contributions.from.toISOString()}
          to={contributions.to.toISOString()}
        />
      </Card>

      <Card as="section">
        <SectionTitle className="mb-4">
          Данные
        </SectionTitle>
        <ProfileNameForm name={user.name} />
      </Card>

      <Card as="section">
        <SectionTitle className="mb-4">
          {user.passwordHash ? "Смена пароля" : "Установка пароля"}
        </SectionTitle>
        <PasswordForm hasPassword={Boolean(user.passwordHash)} />
      </Card>

      <Card as="section">
        <SectionTitle className="mb-1">
          API-токены
        </SectionTitle>
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
      </Card>

      <Card as="section">
        <SectionTitle className="mb-4">
          Интеграция с Trello
        </SectionTitle>
        <TrelloConnection connected={trelloConnected} />
      </Card>
    </div>
  );
}
