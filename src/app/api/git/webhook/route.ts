import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateToken } from "@/lib/tokens";
import { canAccessProject } from "@/lib/access";
import { notifyTaskWatchers } from "@/lib/notify";

/**
 * Приём git-коммитов. Авторизация — Bearer API-токеном (см. /profile).
 * Тело (совместимо с GitHub/GitLab push):
 *   { "commits": [{ "id": "<sha>", "message": "PAY-12 fix bug", "url": "..." }] }
 * Каждое упоминание КЛЮЧ-НОМЕР превращается в запись патч-лога соответствующей
 * задачи (с защитой от повторов по паре задача+sha).
 */
const REF_RE = /\b([A-Z][A-Z0-9]+)-(\d+)\b/g;

export async function POST(req: NextRequest) {
  const user = await authenticateToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Неверный токен" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ожидается JSON" }, { status: 400 });
  }

  const commits = Array.isArray((body as { commits?: unknown }).commits)
    ? ((body as { commits: unknown[] }).commits as Array<Record<string, unknown>>)
    : [];
  if (commits.length === 0) {
    return NextResponse.json({ error: "Нет коммитов" }, { status: 400 });
  }

  let created = 0;
  const skipped: string[] = [];

  for (const c of commits) {
    const sha = String(c.id ?? c.sha ?? "").slice(0, 40);
    const message = String(c.message ?? "").trim();
    const url = typeof c.url === "string" ? c.url : null;
    if (!sha || !message) continue;

    // Уникальные ссылки КЛЮЧ-НОМЕР в сообщении
    const refs = new Map<string, number>();
    for (const m of message.matchAll(REF_RE)) {
      refs.set(`${m[1]}-${m[2]}`, Number(m[2]));
    }

    for (const [code, number] of refs) {
      const key = code.split("-")[0]!;
      const task = await prisma.task.findFirst({
        where: { number, project: { key } },
        select: { id: true, projectId: true, number: true },
      });
      if (!task) {
        skipped.push(`${code} (не найдена)`);
        continue;
      }
      if (!(await canAccessProject(task.projectId, user))) {
        skipped.push(`${code} (нет доступа)`);
        continue;
      }
      // Защита от дублей: одна пара задача+sha — один патч-лог
      try {
        await prisma.gitCommitRef.create({ data: { taskId: task.id, sha } });
      } catch {
        skipped.push(`${code}@${sha.slice(0, 7)} (повтор)`);
        continue;
      }
      const content = url ? `${message}\n\n${url}` : message;
      await prisma.patchLog.create({
        data: {
          taskId: task.id,
          authorId: user.id,
          title: `Коммит ${sha.slice(0, 7)}`,
          content,
        },
      });
      await notifyTaskWatchers(
        task.id,
        user.id,
        "PATCHLOG",
        `${user.name}: коммит ${sha.slice(0, 7)} → ${code}`
      );
      created++;
    }
  }

  return NextResponse.json({ ok: true, created, skipped });
}
