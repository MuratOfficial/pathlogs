import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserCompanyId, isManager } from "@/lib/access";
import { NewCompanyDialog } from "@/components/admin/NewCompanyDialog";
import { CompanyCard } from "@/components/admin/CompanyCard";
import { PageHint } from "@toimetdev/pathlogs-core";

const USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
} as const;

const PROJECT_FIELDS = { id: true, key: true, name: true } as const;

/**
 * Компании — контур видимости проектов и задач. Управляют ими администраторы
 * и менеджеры; менеджер видит и правит только свою компанию.
 */
export default async function CompaniesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;
  if (!isManager(user)) redirect("/dashboard");

  const isAdmin = user.role === "ADMIN";
  const myCompanyId = await getUserCompanyId(user.id);

  const companies = await prisma.company.findMany({
    // Менеджер распоряжается только своей компанией — чужие ему не показываем
    where: isAdmin ? {} : { id: myCompanyId ?? "" },
    include: {
      users: { select: USER_FIELDS, orderBy: { name: "asc" } },
      projects: { select: PROJECT_FIELDS, orderBy: { name: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  // Кандидаты — только нераспределённые: перевод между компаниями делается
  // в два шага (убрать из одной, добавить в другую), и это видно в интерфейсе
  const candidates = await prisma.user.findMany({
    where: { active: true, companyId: null },
    select: USER_FIELDS,
    orderBy: { name: "asc" },
  });

  // Проекты без компании: наследие «до разделения». Админ привязывает любые,
  // менеджер — только те, к которым сам имеет отношение
  const freeProjects = await prisma.project.findMany({
    where: {
      companyId: null,
      ...(isAdmin
        ? {}
        : { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] }),
    },
    select: PROJECT_FIELDS,
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Компании</h1>
          <PageHint>
            Сотрудники и проекты компании видны только внутри неё
          </PageHint>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground"
            >
              ← Пользователи
            </Link>
          )}
          <NewCompanyDialog />
        </div>
      </div>

      {companies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-edge bg-surface/50 p-16 text-center">
          <p className="text-lg font-medium">
            {isAdmin ? "Компаний пока нет" : "Вы не состоите в компании"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {isAdmin
              ? "Создайте компанию и распределите по ней сотрудников и проекты"
              : "Создайте компанию — вы станете её первым сотрудником"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {companies.map((c) => (
            <CompanyCard
              key={c.id}
              company={{ id: c.id, name: c.name, users: c.users, projects: c.projects }}
              candidates={candidates}
              freeProjects={freeProjects}
              canDelete={isAdmin}
            />
          ))}
        </div>
      )}

      {candidates.length > 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-edge bg-surface/50 px-5 py-4 text-sm text-muted">
          Без компании: {candidates.length} чел. Такие пользователи видят только
          проекты, которые тоже не привязаны ни к одной компании.
        </p>
      )}
    </div>
  );
}
