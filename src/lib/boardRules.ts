import type { TaskStatus } from "@prisma/client";

/** Правило доски: попадание в колонку → что сделать с карточкой. */
export interface BoardRuleLike {
  id: string;
  columnId: string;
  setStatus: TaskStatus | null;
  assignUserId: string | null;
  addTagId: string | null;
  active: boolean;
}

/** Что применить к задаче после переноса. */
export interface RulePatch {
  setStatus?: TaskStatus;
  assignUserId?: string;
  addTagIds: string[];
}

/**
 * Складывает правила колонки в одно изменение.
 *
 * Правила одной колонки применяются вместе, а не «первое победило»: если одно
 * ставит статус, а другое — исполнителя, сработать должны оба. При споре за
 * одно и то же поле выигрывает правило, созданное раньше (оно идёт первым
 * в списке) — так поведение доски не меняется от добавления нового правила.
 * Метки не спорят: они складываются.
 */
export function rulePatch(rules: BoardRuleLike[], columnId: string): RulePatch {
  const patch: RulePatch = { addTagIds: [] };
  for (const rule of rules) {
    if (!rule.active || rule.columnId !== columnId) continue;
    if (rule.setStatus && patch.setStatus === undefined) patch.setStatus = rule.setStatus;
    if (rule.assignUserId && patch.assignUserId === undefined) {
      patch.assignUserId = rule.assignUserId;
    }
    if (rule.addTagId && !patch.addTagIds.includes(rule.addTagId)) {
      patch.addTagIds.push(rule.addTagId);
    }
  }
  return patch;
}

/** Есть ли в правиле хоть одно действие — пустое правило сохранять незачем. */
export function ruleHasAction(rule: {
  setStatus?: TaskStatus | null;
  assignUserId?: string | null;
  addTagId?: string | null;
}): boolean {
  return Boolean(rule.setStatus || rule.assignUserId || rule.addTagId);
}

/** Человекочитаемое описание правила — им подписывается строка в списке. */
export function describeRule(
  rule: BoardRuleLike,
  names: {
    column: string;
    status?: string;
    user?: string;
    tag?: string;
  }
): string {
  const actions: string[] = [];
  if (rule.setStatus && names.status) actions.push(`статус → «${names.status}»`);
  if (rule.assignUserId && names.user) actions.push(`исполнитель → ${names.user}`);
  if (rule.addTagId && names.tag) actions.push(`метка «${names.tag}»`);
  return `Карточка попала в «${names.column}»: ${actions.join(", ") || "ничего"}`;
}
