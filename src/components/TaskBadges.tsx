import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  TYPE_COLORS,
  TYPE_LABELS,
  initials,
} from "@/lib/labels";
import type { Priority, TaskType } from "@prisma/client";
import type { TagDTO } from "@/lib/types";

export function TypeBadge({ type }: { type: TaskType }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: `${TYPE_COLORS[type]}26`, color: TYPE_COLORS[type] }}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

// Приоритет как «шкала уровня»: 1–4 возрастающих столбика, заполненных
// по уровню и цветом приоритета — заметнее и нагляднее точки.
const PRIORITY_LEVEL: Record<Priority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const level = PRIORITY_LEVEL[priority];
  const color = PRIORITY_COLORS[priority];
  return (
    <span
      data-tip={`Приоритет: ${PRIORITY_LABELS[priority]}`}
      aria-label={`Приоритет: ${PRIORITY_LABELS[priority]}`}
      role="img"
      className="inline-flex shrink-0 items-end gap-[2px]"
      style={{ height: 13 }}
    >
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-[1px]"
          style={{
            height: 4 + i * 2.5,
            backgroundColor: i <= level ? color : "var(--border)",
          }}
        />
      ))}
    </span>
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

export function AssigneeAvatars({
  assignees,
  size = 6,
}: {
  assignees: { id: string; name: string }[];
  size?: number;
}) {
  if (assignees.length === 0) return null;
  return (
    <span className="flex -space-x-1.5">
      {assignees.slice(0, 3).map((a) => (
        <span
          key={a.id}
          data-tip={a.name}
          className={`flex h-${size} w-${size} items-center justify-center rounded-full border border-surface bg-accent/30 text-[9px] font-bold text-accent-hover`}
          style={{ width: size * 4, height: size * 4 }}
        >
          {initials(a.name)}
        </span>
      ))}
      {assignees.length > 3 && (
        <span
          className="flex items-center justify-center rounded-full border border-surface bg-surface-2 text-[9px] text-muted"
          style={{ width: size * 4, height: size * 4 }}
        >
          +{assignees.length - 3}
        </span>
      )}
    </span>
  );
}
