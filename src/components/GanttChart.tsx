"use client";

// Обёртка над реестровым Gantt (@/components/ui/gantt). Движок дженерик: он
// раскладывает полосы, тянет их за края, рисует зависимости и подсвечивает
// критический путь (логика в ganttLayout.ts, покрыта тестами). Домен задаёт
// обёртка: подпись строки, цвет полосы по статусу, сохранение дат, связи BLOCKS.
import { useRouter } from "next/navigation";
import type { TaskDTO, LinkDTO } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/labels";
import { updateTaskFieldsAction } from "@/lib/actions/tasks";
import { TypeBadge } from "./TaskBadges";
import { Gantt } from "@/components/ui/gantt/Gantt";
import type { GanttEdge } from "@/components/ui/gantt/ganttLayout";

/** Диаграмма Ганта: задачи с датами как полосы, зависимости стрелками. */
export function GanttChart({
  tasks,
  projectKey,
  links = [],
}: {
  tasks: TaskDTO[];
  projectKey: string;
  links?: LinkDTO[];
}) {
  const router = useRouter();

  // Связи чертятся только между задачами, у которых есть даты, — иначе
  // стрелке некуда указывать.
  const datedIds = new Set(tasks.filter((t) => t.startDate || t.dueDate).map((t) => t.id));
  const edges: GanttEdge[] = links
    .filter(
      (l) =>
        l.type === "BLOCKS" &&
        l.fromId !== l.toId &&
        datedIds.has(l.fromId) &&
        datedIds.has(l.toId)
    )
    .map((l) => ({ fromId: l.fromId, toId: l.toId }));

  return (
    <Gantt
      items={tasks}
      edges={edges}
      renderLabel={(t) => (
        <span className="flex items-center gap-2">
          <span className="shrink-0 font-mono text-[11px] font-semibold text-muted">
            {projectKey}-{t.number}
          </span>
          <TypeBadge type={t.type} />
          <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
        </span>
      )}
      onChangeDates={(id, dates) => updateTaskFieldsAction(id, dates)}
      onOpenItem={(t) => router.push(`/tasks/${t.id}`)}
      barColor={(t) => STATUS_COLORS[t.status]}
      locale="ru-RU"
      labels={{
        empty: "Нет задач с датами",
        today: "Сегодня",
        criticalPath: "Критический путь",
        links: "Связей BLOCKS",
        region: "Диаграмма Ганта",
      }}
    />
  );
}
