import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/access";
import { localFilePath, presignedFileUrl } from "@/lib/storage";
import { readFile } from "fs/promises";

/**
 * Единственный вход к вложениям — и для локальных файлов, и для R2. Бакет
 * приватный, поэтому облачный файл отдаётся редиректом на короткоживущую
 * подписанную ссылку, и только после проверки прав на задачу.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { key } = await params;
  const decodedKey = decodeURIComponent(key);

  const attachment = await prisma.attachment.findFirst({
    where: { key: decodedKey },
    include: { task: { select: { projectId: true } } },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }

  // Файл задачи доступен только участникам её проекта
  if (
    attachment.task &&
    !(await canAccessProject(attachment.task.projectId, session.user))
  ) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  if (attachment.storage === "S3") {
    try {
      const url = await presignedFileUrl(
        decodedKey,
        attachment.filename,
        attachment.mime
      );
      // no-store: ссылка живёт минуты, кэшировать редирект нельзя
      return NextResponse.redirect(url, {
        status: 307,
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch (err) {
      console.error(`Не удалось подписать ссылку на ${decodedKey}:`, err);
      return NextResponse.json(
        { error: "Хранилище недоступно" },
        { status: 502 }
      );
    }
  }

  try {
    const data = await readFile(localFilePath(decodedKey));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": attachment.mime,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Файл не найден на диске" }, { status: 404 });
  }
}
