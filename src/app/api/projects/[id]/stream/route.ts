import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/access";
import { LIVE_POLL_MS, LIVE_STREAM_MS, projectVersion } from "@/lib/live";

/** Текущий отпечаток доски — один агрегатный запрос вместо выгрузки задач. */
async function currentVersion(projectId: string): Promise<string> {
  const [tasks, columns] = await Promise.all([
    prisma.task.aggregate({
      where: { projectId },
      _count: true,
      _max: { updatedAt: true },
    }),
    prisma.boardColumn.aggregate({
      where: { projectId },
      _count: true,
      _max: { updatedAt: true },
    }),
  ]);
  return projectVersion({
    taskCount: tasks._count,
    lastTaskUpdate: tasks._max.updatedAt,
    columnCount: columns._count,
    lastColumnUpdate: columns._max.updatedAt,
  });
}

/**
 * Живые обновления доски (Server-Sent Events).
 *
 * Сервер сам заглядывает в БД раз в несколько секунд и присылает событие,
 * только когда отпечаток проекта изменился. Такой опрос на стороне сервера
 * работает на любом хостинге, включая serverless, где общей шины событий
 * между экземплярами просто нет.
 *
 * Соединение закрывается по таймеру, а браузер переподключается сам —
 * это защищает от лимита времени выполнения на хостинге.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Не авторизован", { status: 401 });
  }
  const { id } = await params;
  if (!(await canAccessProject(id, session.user))) {
    return new Response("Проект не найден", { status: 404 });
  }

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let stop: ReturnType<typeof setTimeout> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      let last = await currentVersion(id);
      let closed = false;

      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      const finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        clearTimeout(stop);
        try {
          controller.close();
        } catch {
          /* поток уже закрыт получателем */
        }
      };

      // Первое событие сразу: клиент узнаёт версию, с которой начал смотреть
      send("sync", last);

      timer = setInterval(async () => {
        if (closed) return;
        try {
          const now = await currentVersion(id);
          if (now !== last) {
            last = now;
            send("change", now);
          } else {
            // Комментарий-пульс не даёт прокси закрыть простаивающее соединение
            controller.enqueue(encoder.encode(": ping\n\n"));
          }
        } catch {
          finish();
        }
      }, LIVE_POLL_MS);

      stop = setTimeout(finish, LIVE_STREAM_MS);
      req.signal.addEventListener("abort", finish);
    },
    cancel() {
      clearInterval(timer);
      clearTimeout(stop);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Отключает буферизацию у обратных прокси вроде nginx
      "X-Accel-Buffering": "no",
    },
  });
}
