import { prisma } from "@/lib/prisma";
import type { WebhookEndpoint } from "@prisma/client";

/**
 * Доставка одного события в исходящий вебхук. Поддержаны Slack (incoming
 * webhook), Telegram (Bot API sendMessage) и произвольный JSON-эндпоинт.
 * Ошибки проглатываются — доставка не должна ронять основное действие.
 */
async function deliver(endpoint: WebhookEndpoint, text: string) {
  try {
    if (endpoint.kind === "TELEGRAM") {
      // url — https://api.telegram.org/bot<token>/sendMessage, target — chat_id
      await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: endpoint.target, text }),
      });
    } else {
      // Slack incoming webhook понимает { text }, как и большинство generic-приёмников
      await fetch(endpoint.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    }
  } catch (e) {
    console.error(`webhook ${endpoint.id} (${endpoint.kind}):`, e);
  }
}

/** Рассылает текст события по всем активным вебхукам проекта. */
export async function deliverProjectEvent(projectId: string, text: string) {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { projectId, active: true },
    });
    if (endpoints.length === 0) return;
    await Promise.all(endpoints.map((e) => deliver(e, text)));
  } catch (e) {
    console.error("deliverProjectEvent:", e);
  }
}
