import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/access";
import { buildIcs } from "@/lib/calendar";

/** Выгрузка задачи событием .ics (Google / Outlook / Apple Calendar). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { key: true } } },
  });
  if (!task || !(await canAccessProject(task.projectId, session.user))) {
    return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  }

  const code = `${task.project.key}-${task.number}`;
  const ics = buildIcs(
    {
      title: `${code}: ${task.title}`,
      details: task.description ?? "",
      start: task.startDate,
      due: task.dueDate,
      url: new URL(`/tasks/${task.id}`, req.nextUrl.origin).toString(),
    },
    task.id
  );
  if (!ics) {
    return NextResponse.json(
      { error: "У задачи нет дат — событие не из чего собрать" },
      { status: 400 }
    );
  }

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${code}.ics"`,
    },
  });
}
