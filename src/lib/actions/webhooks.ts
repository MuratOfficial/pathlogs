"use server";

import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/access";
import { deliverProjectEvent } from "@/lib/webhooks";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { WebhookKind } from "@prisma/client";

const schema = z.object({
  projectId: z.string().min(1),
  kind: z.enum(["SLACK", "TELEGRAM", "GENERIC"]),
  url: z.string().url("Некорректный URL"),
  target: z.string().optional(),
});

export async function createWebhookAction(
  _prev: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const parsed = schema.safeParse({
    projectId: formData.get("projectId"),
    kind: formData.get("kind"),
    url: formData.get("url"),
    target: formData.get("target") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }
  const d = parsed.data;
  if (d.kind === "TELEGRAM" && !d.target) {
    return { error: "Для Telegram укажите chat_id" };
  }
  await requireProjectManager(d.projectId);
  await prisma.webhookEndpoint.create({
    data: {
      projectId: d.projectId,
      kind: d.kind as WebhookKind,
      url: d.url,
      target: d.target ?? null,
    },
  });
  revalidatePath(`/projects/${d.projectId}`);
  return {};
}

export async function deleteWebhookAction(id: string) {
  const wh = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id } });
  await requireProjectManager(wh.projectId);
  await prisma.webhookEndpoint.delete({ where: { id } });
  revalidatePath(`/projects/${wh.projectId}`);
}

export async function toggleWebhookAction(id: string) {
  const wh = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id } });
  await requireProjectManager(wh.projectId);
  await prisma.webhookEndpoint.update({
    where: { id },
    data: { active: !wh.active },
  });
  revalidatePath(`/projects/${wh.projectId}`);
}

/** Отправляет тестовое сообщение во все активные вебхуки проекта. */
export async function testWebhooksAction(projectId: string) {
  await requireProjectManager(projectId);
  await deliverProjectEvent(projectId, "PathLogs: проверка вебхука ✅");
}
