import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProjectBackgrounds } from "@/lib/appearance";
import { logoutAction } from "@/lib/actions/auth";
import { ROLE_LABELS, initials } from "@/lib/labels";
import { Hotkeys } from "@/components/Hotkeys";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppShell } from "@/components/AppShell";
import { BrandMark } from "@/components/BrandMark";
import { SidebarToggle } from "@/components/SidebarToggle";
import { TooltipLayer } from "@toimetdev/pathlogs-core";
import { UnreadBadge } from "@/components/UnreadBadge";
import { CommandPalette } from "@/components/CommandPalette";
import { SearchTrigger } from "@/components/SearchTrigger";
import { Icon } from "@/components/ui/Icon";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const unread = await prisma.notification.count({
    where: { userId: user.id, read: false },
  });

  // Проекты, закреплённые пользователем (звёздочка) — быстрый переход в меню
  const pinned = await prisma.projectPin.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { project: { select: { id: true, key: true, name: true } } },
  });
  // Точка у проекта — цвет его персонального фона
  const backgrounds = await getProjectBackgrounds(
    pinned.map((p) => p.project.id),
    user.id
  );

  // Свёрнутое на десктопе меню — узкая рейка (см. globals.css, [data-sidebar]):
  // app-rail-hide прячет подписи, app-rail-center ставит иконку по центру,
  // app-rail-stack складывает ряд кнопок в столбик. У ссылок есть aria-label —
  // в рейке подпись скрыта, а доступное имя остаться должно.
  const navLink =
    "app-rail-center flex items-center gap-3 rounded-lg px-3 py-[var(--app-nav-py)] text-sm text-foreground/90 transition hover:bg-surface-2";

  const sidebar = (
    <>
      <div className="app-rail-center flex items-center gap-2 px-5 py-[var(--app-brand-py)]">
        <Link href="/dashboard" className="app-rail-hide flex min-w-0 flex-1 items-center gap-2.5">
          <BrandMark className="h-8 w-8 rounded-lg" />
          <span className="text-base font-bold tracking-tight">PathLogs</span>
        </Link>
        <SidebarToggle />
      </div>

      <div className="app-rail-hide">
        <SearchTrigger />
      </div>

      <nav className="flex-1 space-y-1 px-3">
          <Link href="/dashboard" aria-label="Проекты" className={navLink}>
            <Icon name="projects" className="h-4 w-4 shrink-0 text-muted" />
            <span className="app-rail-hide">Проекты</span>
          </Link>
          <Link href="/my" aria-label="Мои задачи" className={navLink}>
            <Icon name="check-circle" className="h-4 w-4 shrink-0 text-muted" />
            <span className="app-rail-hide">Мои задачи</span>
          </Link>
          <Link href="/notifications" aria-label="Уведомления" className={`relative ${navLink}`}>
            <Icon name="bell" className="h-4 w-4 shrink-0 text-muted" />
            <span className="app-rail-hide">Уведомления</span>
            <span className="app-rail-badge ml-auto">
              <UnreadBadge initial={unread} />
            </span>
          </Link>
          {user.role === "ADMIN" && (
            <Link href="/admin" aria-label="Админка" className={navLink}>
              <Icon name="users" className="h-4 w-4 shrink-0 text-muted" />
              <span className="app-rail-hide">Админка</span>
            </Link>
          )}
          {(user.role === "ADMIN" || user.role === "MANAGER") && (
            <Link href="/admin/companies" aria-label="Компании" className={navLink}>
              <Icon name="building" className="h-4 w-4 shrink-0 text-muted" />
              <span className="app-rail-hide">Компании</span>
            </Link>
          )}

          {pinned.length > 0 && (
            <div className="space-y-1 pt-4">
              <p className="app-rail-hide px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Закреплённые
              </p>
              {pinned.map(({ project: p }) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  data-tip={p.name}
                  aria-label={p.name}
                  className="app-rail-center flex items-center gap-2.5 rounded-lg px-3 py-[var(--app-nav-py)] text-sm text-foreground/90 transition hover:bg-surface-2"
                >
                  <span
                    aria-hidden
                    className="app-rail-hide h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: backgrounds.get(p.id)?.color ?? "var(--muted)",
                    }}
                  />
                  <span className="shrink-0 font-mono text-[10px] font-bold text-muted">
                    {p.key}
                  </span>
                  <span className="app-rail-hide min-w-0 truncate">{p.name}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>

        <div className="border-t border-edge p-3">
          <div className="app-rail-stack flex items-center gap-3 rounded-lg px-2 py-2">
            <Link
              href="/profile"
              data-tip="Профиль"
              aria-label="Профиль"
              className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-80"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-hover">
                {initials(user.name ?? "?")}
              </span>
              <span className="app-rail-hide min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="block truncate text-xs text-muted">{ROLE_LABELS[user.role]}</span>
              </span>
            </Link>
            <ThemeToggle />
            <form action={logoutAction}>
              <button
                type="submit"
                data-tip="Выйти"
                aria-label="Выйти"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-danger-text"
              >
                <Icon name="logout" className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
    </>
  );

  return (
    <>
      <Hotkeys />
      <TooltipLayer />
      <CommandPalette />
      <AppShell sidebar={sidebar}>{children}</AppShell>
    </>
  );
}
