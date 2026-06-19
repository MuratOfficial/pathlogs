import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  TYPE_COLORS,
  TYPE_LABELS,
  initials,
} from "@/lib/labels";
import type { Priority, TaskType } from "@prisma/client";

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

export function PriorityDot({ priority }: { priority: Priority }) {
  return (
    <span
      data-tip={`Приоритет: ${PRIORITY_LABELS[priority]}`}
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: PRIORITY_COLORS[priority] }}
    />
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
