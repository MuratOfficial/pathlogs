import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/access";
import { buildIcsCalendar } from "@/lib/calendar";

/** Выгрузка всех задач проекта (у которых есть даты) одним файлом .ics. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canAccessProject(id, session.user))) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id },
    select: {
      key: true,
      tasks: {
        where: { OR: [{ startDate: { not: null } }, { dueDate: { not: null } }] },
        select: {
          id: true,
          number: true,
          title: true,
          description: true,
          startDate: true,
          dueDate: true,
        },
        orderBy: { number: "asc" },
      },
    },
  });

  const origin = req.nextUrl.origin;
  const ics = buildIcsCalendar(
    project.tasks.map((t) => ({
      uid: t.id,
      event: {
        title: `${project.key}-${t.number}: ${t.title}`,
        details: t.description ?? "",
        start: t.startDate,
        due: t.dueDate,
        url: `${origin}/tasks/${t.id}`,
      },
    }))
  );
  if (!ics) {
    return NextResponse.json(
      { error: "В проекте нет задач с датами" },
      { status: 400 }
    );
  }

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.key}-calendar.ics"`,
    },
  });
}
