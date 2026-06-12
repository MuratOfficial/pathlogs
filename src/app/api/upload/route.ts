import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/access";
import { storeFile } from "@/lib/storage";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const taskId = formData.get("taskId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Файл больше 25 МБ" }, { status: 413 });
  }

  if (typeof taskId === "string" && taskId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task || !(await canAccessProject(task.projectId, session.user))) {
      return NextResponse.json({ error: "Нет доступа к задаче" }, { status: 403 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await storeFile(buffer, file.name, file.type || "application/octet-stream");

  const attachment = await prisma.attachment.create({
    data: {
      taskId: typeof taskId === "string" && taskId ? taskId : null,
      filename: file.name,
      key: stored.key,
      url: stored.url,
      size: file.size,
      mime: file.type || "application/octet-stream",
      storage: stored.storage,
      uploadedById: session.user.id,
    },
  });

  return NextResponse.json({ attachment });
}
