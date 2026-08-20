"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/auth";
import { canManageProject } from "@/lib/access";
import { ruleHasAction } from "@/lib/boardRules";
import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@prisma/client";

async function requireManager(projectId: string) {
  const user = await requireUser();
  if (!(await canManageProject(projectId, user))) {
    throw new Error("Правилами доски управляет владелец или менеджер проекта");
  }
}

export async function createBoardRuleAction(
  projectId: string,
  rule: {
    columnId: string;
    setStatus?: TaskStatus | null;
    assignUserId?: string | null;
    addTagId?: string | null;
  }
) {
  await requireManager(projectId);
  if (!ruleHasAction(rule)) {
    throw new Error("Выберите хотя бы одно действие для правила");
  }
  // Колонка, метка и исполнитель обязаны быть из этого же проекта
  const column = await prisma.boardColumn.findFirst({
    where: { id: rule.columnId, projectId },
    select: { id: true },
  });
  if (!column) throw new Error("Колонка не найдена в этом проекте");

  if (rule.addTagId) {
    const tag = await prisma.tag.findFirst({
      where: { id: rule.addTagId, projectId },
      select: { id: true },
    });
    if (!tag) throw new Error("Метка не найдена в этом проекте");
  }

  await prisma.boardRule.create({
    data: {
      projectId,
      columnId: rule.columnId,
      setStatus: rule.setStatus ?? null,
      assignUserId: rule.assignUserId ?? null,
      addTagId: rule.addTagId ?? null,
    },
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function toggleBoardRuleAction(ruleId: string) {
  const rule = await prisma.boardRule.findUniqueOrThrow({
    where: { id: ruleId },
    select: { projectId: true, active: true },
  });
  await requireManager(rule.projectId);
  await prisma.boardRule.update({
    where: { id: ruleId },
    data: { active: !rule.active },
  });
  revalidatePath(`/projects/${rule.projectId}`);
}

export async function deleteBoardRuleAction(ruleId: string) {
  const rule = await prisma.boardRule.findUniqueOrThrow({
    where: { id: ruleId },
    select: { projectId: true },
  });
  await requireManager(rule.projectId);
  await prisma.boardRule.delete({ where: { id: ruleId } });
  revalidatePath(`/projects/${rule.projectId}`);
}
