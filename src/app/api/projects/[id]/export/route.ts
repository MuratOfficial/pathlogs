import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/access";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
} from "@/lib/labels";

/** Выгрузка проекта в XLSX: листы «Задачи» и «Трудозатраты». */
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

  const project = await prisma.project.findUniqueOrThrow({
    where: { id },
    include: {
      tasks: {
        include: {
          assignees: { select: { name: true } },
          creator: { select: { name: true } },
          parent: { select: { number: true } },
          timeEntries: {
            include: { user: { select: { name: true } } },
            orderBy: { date: "asc" },
          },
          checklist: { orderBy: { order: "asc" } },
          _count: { select: { patchLogs: true } },
        },
        orderBy: { number: "asc" },
      },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "PathLogs";
  wb.created = new Date();

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } },
    alignment: { vertical: "middle" },
  };

  // ===== Лист «Задачи» =====
  const tasksSheet = wb.addWorksheet("Задачи", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  tasksSheet.columns = [
    { header: "Код", key: "code", width: 10 },
    { header: "Название", key: "title", width: 42 },
    { header: "Статус", key: "status", width: 14 },
    { header: "Тип", key: "type", width: 14 },
    { header: "Приоритет", key: "priority", width: 12 },
    { header: "Родитель", key: "parent", width: 10 },
    { header: "Исполнители", key: "assignees", width: 24 },
    { header: "Автор", key: "creator", width: 18 },
    { header: "Начало", key: "start", width: 12 },
    { header: "Срок", key: "due", width: 12 },
    { header: "Оценка, ч", key: "estimate", width: 11 },
    { header: "Потрачено, ч", key: "spent", width: 13 },
    { header: "Чек-лист", key: "checklist", width: 12 },
    { header: "Патч-логов", key: "logs", width: 11 },
    { header: "Создана", key: "created", width: 12 },
    { header: "Описание", key: "description", width: 60 },
  ];
  tasksSheet.getRow(1).eachCell((c) => Object.assign(c, { style: headerStyle }));

  for (const t of project.tasks) {
    const spent = t.timeEntries.reduce((s, e) => s + e.hours, 0);
    const doneItems = t.checklist.filter((i) => i.done).length;
    tasksSheet.addRow({
      code: `${project.key}-${t.number}`,
      title: t.title,
      status: STATUS_LABELS[t.status],
      type: TYPE_LABELS[t.type],
      priority: PRIORITY_LABELS[t.priority],
      parent: t.parent ? `${project.key}-${t.parent.number}` : "",
      assignees: t.assignees.map((a) => a.name).join(", "),
      creator: t.creator.name,
      start: t.startDate ?? "",
      due: t.dueDate ?? "",
      estimate: t.estimateHours ?? "",
      spent: spent || "",
      checklist: t.checklist.length ? `${doneItems}/${t.checklist.length}` : "",
      logs: t._count.patchLogs || "",
      created: t.createdAt,
      description: t.description ?? "",
    });
  }
  for (const col of ["start", "due", "created"]) {
    tasksSheet.getColumn(col).numFmt = "dd.mm.yyyy";
  }
  tasksSheet.autoFilter = { from: "A1", to: "P1" };

  // ===== Лист «Трудозатраты» =====
  const timeSheet = wb.addWorksheet("Трудозатраты", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  timeSheet.columns = [
    { header: "Задача", key: "code", width: 10 },
    { header: "Название", key: "title", width: 42 },
    { header: "Сотрудник", key: "user", width: 22 },
    { header: "Часы", key: "hours", width: 8 },
    { header: "Дата", key: "date", width: 12 },
    { header: "Комментарий", key: "note", width: 50 },
  ];
  timeSheet.getRow(1).eachCell((c) => Object.assign(c, { style: headerStyle }));
  for (const t of project.tasks) {
    for (const e of t.timeEntries) {
      timeSheet.addRow({
        code: `${project.key}-${t.number}`,
        title: t.title,
        user: e.user.name,
        hours: e.hours,
        date: e.date,
        note: e.note ?? "",
      });
    }
  }
  timeSheet.getColumn("date").numFmt = "dd.mm.yyyy";
  timeSheet.autoFilter = { from: "A1", to: "F1" };

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `${project.key}-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
