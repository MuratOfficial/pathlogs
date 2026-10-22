import { prisma } from "@/lib/prisma";
import { deleteStoredFiles } from "@/lib/storage";
import { DRAFT_TTL_MS } from "@/lib/attachments";

/**
 * Черновые вложения — файлы, загруженные в форме создания задачи, когда самой
 * задачи ещё нет. У такого вложения заполнен projectId и пуст taskId; права
 * на него есть только у того, кто его загрузил (см. /api/files/[key]).
 */

/**
 * Привязывает черновики к созданной задаче.
 *
 * Одним запросом с полным условием: только свои (uploadedById), только ещё не
 * привязанные (taskId: null) и только из того же проекта. Чужой id в форме
 * поэтому ничего не делает — вложение не переедет в другую задачу.
 * Возвращает, сколько файлов действительно привязалось.
 */
export async function bindDraftAttachments(params: {
  ids: string[];
  taskId: string;
  projectId: string;
  userId: string;
}): Promise<number> {
  const { ids, taskId, projectId, userId } = params;
  if (ids.length === 0) return 0;
  const { count } = await prisma.attachment.updateMany({
    where: {
      id: { in: ids },
      taskId: null,
      projectId,
      uploadedById: userId,
    },
    data: { taskId },
  });
  return count;
}

/**
 * Убирает брошенные черновики: форму создания закрыли, а файлы уже лежат в
 * хранилище и занимают квоту. Старше суток — значит задача так и не создана.
 *
 * Заодно подчищает вложения без задачи, оставшиеся от прежних версий: их
 * не отдаёт ни одна страница, а место они занимают.
 */
export async function purgeStaleDraftAttachments(): Promise<number> {
  const stale = await prisma.attachment.findMany({
    where: { taskId: null, createdAt: { lt: new Date(Date.now() - DRAFT_TTL_MS) } },
    select: { id: true, key: true, storage: true },
    take: 200,
  });
  if (stale.length === 0) return 0;

  await prisma.attachment.deleteMany({
    where: { id: { in: stale.map((a) => a.id) } },
  });
  // Сначала запись, потом файл: при сбое хранилища останется мусорный объект,
  // а не вложение, ссылающееся в пустоту.
  await deleteStoredFiles(stale);
  return stale.length;
}
