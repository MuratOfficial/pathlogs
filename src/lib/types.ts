import type { LinkType, Priority, TaskStatus, TaskType } from "@prisma/client";

/** Сериализуемое представление задачи для клиентских компонентов (канбан, граф). */
export interface TaskDTO {
  id: string;
  number: number;
  title: string;
  status: TaskStatus;
  type: TaskType;
  priority: Priority;
  parentId: string | null;
  columnId: string | null;
  color: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  spentHours: number;
  order: number;
  assignees: { id: string; name: string }[];
  patchLogCount: number;
  childrenCount: number;
}

/** Колонка канбан-доски. status задан у стандартных колонок, null — у кастомных. */
export interface ColumnDTO {
  id: string;
  name: string;
  color: string;
  order: number;
  status: TaskStatus | null;
}

export interface LinkDTO {
  id: string;
  fromId: string;
  toId: string;
  type: LinkType;
}

export interface MemberDTO {
  id: string;
  name: string;
}
