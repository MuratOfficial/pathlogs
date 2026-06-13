"use server";

import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/access";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Priority, TaskType } from "@prisma/client";

const templateSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(2, "Название шаблона — минимум 2 символа"),
  type: z.enum(["FEATURE", "BUG", "REFACTOR", "ANALYTICS", "MANAGEMENT", "DESIGN", "DOCS", "RESEARCH"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  titlePrefix: z.string().optional(),
  description: z.string().optional(),
  estimateHours: z.coerce.number().positive().optional(),
  checklist: z.string().optional(),
});

/** Создание шаблона — право управления проектом (владелец, менеджер, админ). */
export async function createTemplateAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = templateSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    type: formData.get("type"),
    priority: formData.get("priority"),
    titlePrefix: formData.get("titlePrefix") || undefined,
    description: formData.get("description") || undefined,
    estimateHours: formData.get("estimateHours") || undefined,
    checklist: formData.get("checklist") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const d = parsed.data;
  await requireProjectManager(d.projectId);
  await prisma.taskTemplate.create({
    data: {
      projectId: d.projectId,
      name: d.name,
      type: d.type as TaskType,
      priority: d.priority as Priority,
      titlePrefix: d.titlePrefix ?? null,
      description: d.description ?? null,
      estimateHours: d.estimateHours ?? null,
      checklist: d.checklist ?? null,
    },
  });
  revalidatePath(`/projects/${d.projectId}`);
  return {};
}

export async function deleteTemplateAction(id: string) {
  const tpl = await prisma.taskTemplate.findUniqueOrThrow({
    where: { id },
    select: { projectId: true },
  });
  await requireProjectManager(tpl.projectId);
  await prisma.taskTemplate.delete({ where: { id } });
  revalidatePath(`/projects/${tpl.projectId}`);
}
