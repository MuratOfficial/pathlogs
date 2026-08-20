import { describe, it, expect } from "vitest";
import { buildCommentThreads } from "@/lib/comments";

/** Комментарий: id, родитель и минута создания. */
function c(id: string, parentId: string | null, minute: number) {
  return { id, parentId, createdAt: new Date(2026, 0, 1, 12, minute) };
}

describe("buildCommentThreads", () => {
  it("комментарии без ответов — просто список веток", () => {
    const threads = buildCommentThreads([c("a", null, 1), c("b", null, 2)]);
    expect(threads.map((t) => t.root.id)).toEqual(["a", "b"]);
    expect(threads.every((t) => t.replies.length === 0)).toBe(true);
  });

  it("ответы собираются под своим корнем", () => {
    const threads = buildCommentThreads([
      c("a", null, 1),
      c("b", null, 2),
      c("a1", "a", 3),
      c("b1", "b", 4),
      c("a2", "a", 5),
    ]);
    expect(threads).toHaveLength(2);
    expect(threads[0]!.replies.map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(threads[1]!.replies.map((r) => r.id)).toEqual(["b1"]);
  });

  it("ответ на ответ остаётся в той же ветке, а не уходит на третий уровень", () => {
    const threads = buildCommentThreads([c("a", null, 1), c("a1", "a", 2), c("a2", "a1", 3)]);
    expect(threads).toHaveLength(1);
    expect(threads[0]!.replies.map((r) => r.id)).toEqual(["a1", "a2"]);
  });

  it("порядок веток и ответов — по времени", () => {
    const threads = buildCommentThreads([
      c("second", null, 5),
      c("first", null, 1),
      c("late", "first", 9),
      c("early", "first", 2),
    ]);
    expect(threads.map((t) => t.root.id)).toEqual(["first", "second"]);
    expect(threads[0]!.replies.map((r) => r.id)).toEqual(["early", "late"]);
  });

  it("ответ на удалённый комментарий не теряется — становится корнем", () => {
    const threads = buildCommentThreads([c("a", null, 1), c("сирота", "нет-такого", 2)]);
    expect(threads.map((t) => t.root.id)).toEqual(["a", "сирота"]);
  });

  it("повреждённые данные с циклом не вешают сборку", () => {
    const threads = buildCommentThreads([c("x", "y", 1), c("y", "x", 2)]);
    expect(threads.length).toBeGreaterThan(0);
  });

  it("пустое обсуждение — пустой список", () => {
    expect(buildCommentThreads([])).toEqual([]);
  });
});
