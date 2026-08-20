/** Комментарий в том виде, в каком он нужен для сборки веток. */
export interface ThreadableComment {
  id: string;
  parentId: string | null;
  createdAt: Date | string;
}

/** Ветка обсуждения: корневой комментарий и ответы под ним. */
export interface CommentThread<T extends ThreadableComment> {
  root: T;
  replies: T[];
}

/**
 * Собирает плоский список комментариев в одноуровневые ветки.
 *
 * Одноуровневые намеренно: ответ на ответ крепится к тому же корню, иначе
 * обсуждение превращается в лестницу, которую некуда сдвигать на телефоне.
 * Комментарий, чей родитель удалён или относится к другой задаче, показываем
 * как корневой — потерять его хуже, чем нарушить вложенность.
 *
 * Корни идут в порядке появления, ответы внутри ветки — тоже.
 */
export function buildCommentThreads<T extends ThreadableComment>(
  comments: T[]
): CommentThread<T>[] {
  const byId = new Map(comments.map((c) => [c.id, c]));

  /** Корень ветки: поднимаемся вверх, пока родитель существует. */
  function rootIdOf(c: T): string {
    const seen = new Set<string>([c.id]);
    let cur = c;
    while (cur.parentId) {
      const parent = byId.get(cur.parentId);
      // Родителя нет или цикл (данные повреждены) — дальше не идём
      if (!parent || seen.has(parent.id)) break;
      seen.add(parent.id);
      cur = parent;
    }
    return cur.id;
  }

  const byTime = [...comments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const threads = new Map<string, CommentThread<T>>();
  const orphans: T[] = [];

  for (const c of byTime) {
    if (rootIdOf(c) === c.id) threads.set(c.id, { root: c, replies: [] });
  }
  for (const c of byTime) {
    const rootId = rootIdOf(c);
    if (rootId === c.id) continue;
    const thread = threads.get(rootId);
    if (thread) thread.replies.push(c);
    else orphans.push(c);
  }

  // Осиротевшие ответы (корень не пришёл в выборке) показываем отдельно
  return [...threads.values(), ...orphans.map((root) => ({ root, replies: [] }))];
}
