import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  TYPE_COLORS,
  TYPE_LABELS,
} from "@/lib/labels";
import type { Priority, TaskType } from "@prisma/client";
import type { TagDTO } from "@/lib/types";
import { Badge, LevelMeter, AvatarStack } from "@toimetdev/pathlogs-core";

/** Тип задачи меткой-«пилюлей» в цвете типа (Badge из @toimetdev/pathlogs-core). */
export function TypeBadge({ type }: { type: TaskType }) {
  return <Badge color={TYPE_COLORS[type]}>{TYPE_LABELS[type]}</Badge>;
}

// Приоритет как «шкала уровня»: 1–4 возрастающих столбика (LevelMeter) —
// заметнее и нагляднее точки, и смысл несёт не только цвет.
const PRIORITY_LEVEL: Record<Priority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <LevelMeter
      level={PRIORITY_LEVEL[priority]}
      color={PRIORITY_COLORS[priority]}
      label={`Приоритет: ${PRIORITY_LABELS[priority]}`}
    />
  );
}

/** Одна метка-«пилюля» в цвете метки. */
export function TagChip({ tag, small = false }: { tag: TagDTO; small?: boolean }) {
  return (
    <span
      className={`inline-flex max-w-[10rem] items-center gap-1 truncate rounded-full font-medium ${
        small ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"
      }`}
      style={{
        backgroundColor: `${tag.color}24`,
        color: tag.color,
        boxShadow: `inset 0 0 0 1px ${tag.color}59`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: tag.color }}
      />
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

/** Строка меток задачи; при переполнении показывает «+N». */
export function TagChips({
  tags,
  max = 3,
  small = false,
}: {
  tags: TagDTO[];
  max?: number;
  small?: boolean;
}) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, max);
  const rest = tags.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((t) => (
        <TagChip key={t.id} tag={t} small={small} />
      ))}
      {rest > 0 && (
        <span
          data-tip={tags.slice(max).map((t) => t.name).join(", ")}
          className={`rounded-full bg-surface-2 text-muted ${
            small ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"
          }`}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

/** Стопка аватаров исполнителей (AvatarStack из @toimetdev/pathlogs-core):
 *  инициалы с нахлёстом, остаток «+N» с именами в подсказке. */
export function AssigneeAvatars({
  assignees,
}: {
  assignees: { id: string; name: string }[];
}) {
  return <AvatarStack people={assignees} max={3} size="sm" />;
}
