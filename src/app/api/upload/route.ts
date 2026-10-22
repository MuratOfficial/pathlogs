import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/access";
import { isS3Configured, storeFile } from "@/lib/storage";
import { MAX_ATTACHMENT_SIZE } from "@/lib/attachments";
import { purgeStaleDraftAttachments } from "@/lib/draftAttachments";
import {
  fitsInQuota,
  formatBytes,
  quotaLimitBytes,
  usedStorageBytes,
} from "@/lib/storageQuota";
import type { AttachmentDTO } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const user = session.user;

  const formData = await req.formData();
  const file = formData.get("file");
  const taskId = formData.get("taskId");
  const draftProjectId = formData.get("projectId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return NextResponse.json({ error: "Файл больше 25 МБ" }, { status: 413 });
  }

  // Файл всегда принадлежит проекту: по проекту проверяются права и на
  // загрузку, и на скачивание. Обычно проект берётся у задачи; в форме
  // создания задачи ещё нет, и проект приходит из формы — такой файл
  // остаётся черновиком до привязки (см. bindDraftAttachments).
  let projectId: string;
  let boundTaskId: string | null = null;
  if (typeof taskId === "string" && taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task || !(await canAccessProject(task.projectId, user))) {
      return NextResponse.json({ error: "Нет доступа к задаче" }, { status: 403 });
    }
    projectId = task.projectId;
    boundTaskId = taskId;
  } else if (typeof draftProjectId === "string" && draftProjectId) {
    if (!(await canAccessProject(draftProjectId, user))) {
      return NextResponse.json({ error: "Нет доступа к проекту" }, { status: 403 });
    }
    projectId = draftProjectId;
  } else {
    return NextResponse.json(
      { error: "Не указана задача или проект" },
      { status: 400 }
    );
  }

  // Квота проверяется только для облака: локальный диск на счёт Cloudflare
  // не влияет. Иначе файл уедет в R2 и уже там начнёт стоить денег.
  if (isS3Configured()) {
    const limit = quotaLimitBytes();
    const used = await usedStorageBytes();
    if (!fitsInQuota(used, file.size, limit)) {
      return NextResponse.json(
        {
          error: `Хранилище заполнено: занято ${formatBytes(used)} из ${formatBytes(limit)}. Удалите ненужные вложения и повторите.`,
        },
        { status: 507 }
      );
    }
  }

  // Уборка брошенных черновиков — до загрузки: иначе место под новый файл
  // считалось бы вместе с теми, что давно никому не нужны.
  if (!boundTaskId) {
    try {
      await purgeStaleDraftAttachments();
    } catch (err) {
      console.error("Не удалось убрать черновые вложения:", err);
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storeFile(buffer, file.name, file.type || "application/octet-stream");

  const attachment = await prisma.attachment.create({
    data: {
      taskId: boundTaskId,
      projectId,
      filename: file.name,
      key: stored.key,
      url: stored.url,
      size: file.size,
      mime: file.type || "application/octet-stream",
      storage: stored.storage,
      uploadedById: user.id,
    },
  });

  const dto: AttachmentDTO = {
    id: attachment.id,
    taskId: attachment.taskId,
    filename: attachment.filename,
    url: attachment.url,
    mime: attachment.mime,
    size: attachment.size,
    storage: attachment.storage,
    createdAt: attachment.createdAt.toISOString(),
    uploadedBy: { id: user.id, name: user.name ?? "" },
    canDelete: true,
  };

  return NextResponse.json({ attachment: dto });
}
