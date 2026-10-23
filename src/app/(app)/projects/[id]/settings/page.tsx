import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { canAccessProject, canManageProject } from "@/lib/access";
import { getProjectBackground } from "@/lib/appearance";
import type { ColumnDTO, MemberDTO, TaskTemplateDTO } from "@/lib/types";
import { BackButton } from "@/components/BackButton";
import { ProjectBackdrop } from "@/components/ProjectBackdrop";
import { DialogInline } from "@/components/Dialog";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { ProjectBackgroundDialog } from "@/components/ProjectBackgroundDialog";
import { TemplatesDialog } from "@/components/TemplatesDialog";
import { BoardRulesDialog } from "@/components/BoardRulesDialog";
import { IntakeDialog } from "@/components/IntakeDialog";
import { ShareRoadmapDialog } from "@/components/ShareRoadmapDialog";
import { WebhooksDialog } from "@/components/WebhooksDialog";
import { ArchiveProjectButton } from "@/components/ArchiveProjectButton";
import { Card, SectionTitle } from "@/components/ui/Card";

/**
 * Настройки проекта одной страницей.
 *
 * Раньше это были восемь модальных окон: кнопки в шапке проекта и пункты
 * меню «Ещё». Формы остались теми же компонентами — внутри <DialogInline>
 * окно рисуется секцией страницы (см. Dialog.tsx).
 */
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  // Чужой проект неотличим от несуществующего
  if (!(await canAccessProject(id, user))) notFound();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      tags: { orderBy: { name: "asc" }, select: { id: true, name: true, color: true } },
      members: { include: { user: { select: { id: true, name: true } } } },
      owner: { select: { id: true, name: true } },
      columns: { orderBy: { order: "asc" } },
      templates: { orderBy: { createdAt: "asc" } },
      webhooks: { orderBy: { createdAt: "asc" } },
      intakeForm: { select: { token: true, columnId: true, active: true } },
      boardRules: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) notFound();

  const canManage = await canManageProject(id, user);
  const background = await getProjectBackground(id, user.id);

  const members: MemberDTO[] = project.members.some((m) => m.user.id === project.ownerId)
    ? project.members.map((m) => m.user)
    : [project.owner, ...project.members.map((m) => m.user)];

  const columns: ColumnDTO[] = project.columns.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    order: c.order,
    status: c.status,
    wipLimit: c.wipLimit,
    sort: c.sort,
    hidden: c.hidden,
  }));

  const templates: TaskTemplateDTO[] = project.templates.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    priority: t.priority,
    titlePrefix: t.titlePrefix,
    description: t.description,
    estimateHours: t.estimateHours,
    checklist: t.checklist,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <ProjectBackdrop background={background} />

      <div className="flex items-center gap-3">
        <BackButton />
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Настройки проекта</h1>
          <Link
            href={`/projects/${project.id}`}
            className="text-sm text-muted transition hover:text-foreground"
          >
            <span className="font-mono font-semibold">{project.key}</span> · {project.name}
          </Link>
        </div>
      </div>

      <DialogInline>
        {canManage && (
          <EditProjectDialog
            projectId={project.id}
            name={project.name}
            projectKey={project.key}
            description={project.description}
          />
        )}
        <ProjectBackgroundDialog projectId={project.id} background={background} />
        <TemplatesDialog projectId={project.id} templates={templates} canManage={canManage} />
        {canManage && (
          <BoardRulesDialog
            projectId={project.id}
            columns={columns}
            members={members}
            tags={project.tags}
            rules={project.boardRules.map((r) => ({
              id: r.id,
              columnId: r.columnId,
              setStatus: r.setStatus,
              assignUserId: r.assignUserId,
              addTagId: r.addTagId,
              active: r.active,
            }))}
          />
        )}
        {canManage && (
          <IntakeDialog projectId={project.id} columns={columns} initial={project.intakeForm} />
        )}
        {canManage && (
          <ShareRoadmapDialog projectId={project.id} initialToken={project.publicToken} />
        )}
        <WebhooksDialog
          projectId={project.id}
          webhooks={project.webhooks.map((w) => ({
            id: w.id,
            kind: w.kind,
            url: w.url,
            target: w.target,
            active: w.active,
          }))}
          canManage={canManage}
        />
      </DialogInline>

      {canManage && (
        <Card as="section" aria-label="Архив">
          <SectionTitle className="mb-2">Архив</SectionTitle>
          <p className="mb-4 text-sm text-muted">
            {project.status === "ARCHIVED"
              ? "Проект в архиве: он скрыт из списка активных. Данные на месте."
              : "Архивный проект скрывается из списка активных. Данные сохраняются, вернуть проект можно в любой момент."}
          </p>
          <ArchiveProjectButton
            projectId={project.id}
            archived={project.status === "ARCHIVED"}
            withLabel
          />
        </Card>
      )}
    </div>
  );
}
