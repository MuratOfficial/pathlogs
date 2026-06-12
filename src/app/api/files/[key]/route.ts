import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/access";
import { localFilePath } from "@/lib/storage";
import { readFile } from "fs/promises";

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
    where: { key: decodedKey, storage: "LOCAL" },
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

  try {
    const data = await readFile(localFilePath(decodedKey));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": attachment.mime,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Файл не найден на диске" }, { status: 404 });
  }
}
