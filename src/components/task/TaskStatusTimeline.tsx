import { STATUS_LABELS, STATUS_COLORS } from "@/lib/labels";
import type { TaskStatus } from "@prisma/client";

export type StatusEvent = {
  id: string;
  toStatus: TaskStatus;
  at: Date;
  actor: string | null;
};

function fmtDuration(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "меньше минуты";
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH ? `${d} дн ${remH} ч` : `${d} дн`;
}

function fmtAt(d: Date): string {
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * «Машина времени» задачи: путь по статусам во времени — когда, кем и сколько
 * задача провела в каждом статусе.
 */
export function TaskStatusTimeline({ events }: { events: StatusEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted">
        История пока пуста — она копится при каждой смене статуса.
      </p>
    );
  }

  return (
    <ol className="relative space-y-1 border-l border-edge pl-5">
      {events.map((e, i) => {
        const next = events[i + 1];
        const durMs = (next ? next.at.getTime() : Date.now()) - e.at.getTime();
        const color = STATUS_COLORS[e.toStatus];
        const isCurrent = !next;
        return (
          <li key={e.id} className="relative py-1.5">
            <span
              className="absolute -left-[26px] top-2.5 h-3 w-3 rounded-full border-2 border-background"
              style={{ backgroundColor: color, boxShadow: isCurrent ? `0 0 0 3px ${color}33` : undefined }}
            />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span
                className="rounded px-1.5 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: color + "26", color }}
              >
                {STATUS_LABELS[e.toStatus]}
              </span>
              <span className="text-xs text-muted">{fmtAt(e.at)}</span>
              {e.actor && <span className="text-xs text-muted">· {e.actor}</span>}
            </div>
            <p className="mt-0.5 text-xs text-muted/80">
              {isCurrent ? "в этом статусе " : "длилось "}
              <span className="text-foreground/80">{fmtDuration(durMs)}</span>
              {isCurrent && " (сейчас)"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
