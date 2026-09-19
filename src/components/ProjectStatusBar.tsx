"use client";

import { useRouter } from "next/navigation";
import { StatusBar, type StatusBarSegment } from "@toimetdev/pathlogs-core";
import { formatHours } from "@/lib/labels";

/**
 * Нижняя полоса проекта: те же цифры, что раньше стояли в шапке под
 * `hidden md:flex`.
 *
 * Разница в поведении на узком экране. Раньше вся строка просто исчезала —
 * на телефоне не оставалось ни одной цифры. StatusBar вместо этого меряет
 * сегменты и убирает наименее важные в «ещё», поэтому «Просрочено» видно
 * всегда: у него priority выше, чем у «Всего» и «Затрачено».
 */
export function ProjectStatusBar({
  projectId,
  open,
  total,
  overdue,
  spentHours,
  members,
  tags,
}: {
  projectId: string;
  open: number;
  total: number;
  overdue: number;
  spentHours: number;
  members: number;
  tags: number;
}) {
  const router = useRouter();

  const segments: StatusBarSegment[] = [
    {
      id: "open",
      pinned: true,
      tip: "Задачи не в статусе «Готово», «Закрыта» или «В архиве»",
      content: (
        <>
          Открыто: <b className="text-foreground">{open}</b>
        </>
      ),
    },
  ];

  if (overdue > 0) {
    segments.push({
      id: "overdue",
      priority: 100,
      tip: "Срок прошёл, а задача не закрыта",
      onClick: () => router.push(`/projects/${projectId}?view=list`),
      content: <span className="font-semibold text-danger">Просрочено: {overdue}</span>,
    });
  }

  segments.push(
    {
      id: "total",
      priority: 40,
      content: (
        <>
          Всего: <b className="text-foreground">{total}</b>
        </>
      ),
    },
    {
      id: "spent",
      priority: 30,
      tip: "Сумма списанного времени по всем задачам проекта",
      content: (
        <>
          Затрачено: <b className="text-foreground">{formatHours(spentHours)}</b>
        </>
      ),
    },
    {
      id: "members",
      priority: 20,
      align: "right",
      content: <>Участников: {members}</>,
    },
    {
      id: "tags",
      priority: 10,
      align: "right",
      content: <>Меток: {tags}</>,
    }
  );

  return <StatusBar segments={segments} />;
}
