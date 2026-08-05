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
  startDate: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  spentHours: number;
  order: number;
  assignees: { id: string; name: string }[];
  tags: TagDTO[];
  patchLogCount: number;
  childrenCount: number;
}

/** Метка задачи (в рамках проекта). */
export interface TagDTO {
  id: string;
  name: string;
  color: string;
}

/** Колонка канбан-доски. status задан у стандартных колонок, null — у кастомных. */
export interface ColumnDTO {
  id: string;
  name: string;
  color: string;
  order: number;
  status: TaskStatus | null;
  /** WIP-лимит: при превышении колонка подсвечивается. null — без лимита. */
  wipLimit: number | null;
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

/** Полезная ссылка проекта или задачи. */
export interface ResourceLinkDTO {
  id: string;
  url: string;
  /** Необязательное название; если null — показываем хост. */
  title: string | null;
  description: string | null;
  author: MemberDTO;
  createdAt: string;
  /** Текущий пользователь может редактировать и удалять ссылку. */
  canEdit: boolean;
}

/** Вариант ответа опроса вместе с результатами голосования. */
export interface PollOptionDTO {
  id: string;
  text: string;
  votes: number;
  /** Кто выбрал этот вариант. Пусто у анонимных опросов. */
  voters: MemberDTO[];
  chosenByMe: boolean;
}

/** Опрос участников проекта. */
export interface PollDTO {
  id: string;
  question: string;
  description: string | null;
  /** Разрешён выбор нескольких вариантов. */
  multiple: boolean;
  /** Имена проголосовавших скрыты. */
  anonymous: boolean;
  closed: boolean;
  author: MemberDTO;
  createdAt: string;
  options: PollOptionDTO[];
  /** Сколько человек проголосовало (не голосов, а людей). */
  voterCount: number;
  /** Текущий пользователь может завершить/удалить опрос. */
  canManage: boolean;
}

/** Шаблон задачи для предзаполнения формы создания. */
export interface TaskTemplateDTO {
  id: string;
  name: string;
  type: TaskType;
  priority: Priority;
  titlePrefix: string | null;
  description: string | null;
  estimateHours: number | null;
  checklist: string | null;
}
