import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/access";
import { projectVersion } from "@/lib/live";

/**
 * Отпечаток доски одним коротким запросом: два агрегата вместо выгрузки задач.
 *
 * Живая доска опрашивает его раз в LIVE_POLL_MS и, увидев новое значение,
 * перерисовывает страницу через router.refresh(). Пришло на смену SSE-потоку:
 * тот держал функцию занятой всё время, пока открыта вкладка, хотя push всё
 * равно не давал — опрос БД шёл внутри потока.
 */
export async function GET(
  _req: NextRequest,
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

  const [tasks, columns] = await Promise.all([
    prisma.task.aggregate({
      where: { projectId: id },
      _count: true,
      _max: { updatedAt: true },
    }),
    prisma.boardColumn.aggregate({
      where: { projectId: id },
      _count: true,
      _max: { updatedAt: true },
    }),
  ]);

  const version = projectVersion({
    taskCount: tasks._count,
    lastTaskUpdate: tasks._max.updatedAt,
    columnCount: columns._count,
    lastColumnUpdate: columns._max.updatedAt,
  });

  return NextResponse.json(
    { version },
    // Ответ живёт ровно до следующего опроса — кэшировать нечего
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
