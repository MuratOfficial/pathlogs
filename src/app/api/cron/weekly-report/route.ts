import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateToken } from "@/lib/tokens";
import { buildWeeklyReport } from "@/lib/report";
import { sendMail } from "@/lib/email";

/**
 * Рассылка недельных отчётов по активным проектам. Авторизация — Bearer-токеном
 * администратора (создаётся в /profile). Ставится на cron (например, по
 * понедельникам). Письма уходят участникам каждого проекта; без SMTP —
 * логируются. ?projectId=… — отчёт только по одному проекту.
 */
export async function POST(req: NextRequest) {
  const user = await authenticateToken(req.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Неверный токен" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Требуются права администратора" }, { status: 403 });
  }

  const onlyProject = req.nextUrl.searchParams.get("projectId");
  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE", ...(onlyProject ? { id: onlyProject } : {}) },
    select: { id: true },
  });

  const results: unknown[] = [];
  for (const p of projects) {
    const report = await buildWeeklyReport(p.id);
    if (!report) continue;
    let delivered = 0;
    for (const email of report.recipients) {
      const r = await sendMail(email, report.subject, report.html);
      if (r.delivered) delivered++;
    }
    results.push({ ...report.summary, recipients: report.recipients.length, delivered });
  }

  return NextResponse.json({ ok: true, projects: results });
}
