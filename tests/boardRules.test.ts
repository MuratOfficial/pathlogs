import { describe, it, expect } from "vitest";
import { describeRule, rulePatch, ruleHasAction, type BoardRuleLike } from "@/lib/boardRules";

const rule = (over: Partial<BoardRuleLike> = {}): BoardRuleLike => ({
  id: "r1",
  columnId: "готово",
  setStatus: null,
  assignUserId: null,
  addTagId: null,
  active: true,
  ...over,
});

describe("rulePatch", () => {
  it("без правил ничего не меняется", () => {
    expect(rulePatch([], "готово")).toEqual({ addTagIds: [] });
  });

  it("правило чужой колонки не срабатывает", () => {
    const patch = rulePatch([rule({ columnId: "в работе", setStatus: "DONE" })], "готово");
    expect(patch.setStatus).toBeUndefined();
  });

  it("выключенное правило игнорируется", () => {
    const patch = rulePatch([rule({ setStatus: "DONE", active: false })], "готово");
    expect(patch.setStatus).toBeUndefined();
  });

  it("правила одной колонки складываются, а не отменяют друг друга", () => {
    const patch = rulePatch(
      [rule({ setStatus: "DONE" }), rule({ id: "r2", assignUserId: "маша" })],
      "готово"
    );
    expect(patch).toEqual({ setStatus: "DONE", assignUserId: "маша", addTagIds: [] });
  });

  it("за одно поле спорят — выигрывает более раннее правило", () => {
    const patch = rulePatch(
      [rule({ setStatus: "DONE" }), rule({ id: "r2", setStatus: "REVIEW" })],
      "готово"
    );
    expect(patch.setStatus).toBe("DONE");
  });

  it("метки складываются и не дублируются", () => {
    const patch = rulePatch(
      [
        rule({ addTagId: "срочно" }),
        rule({ id: "r2", addTagId: "релиз" }),
        rule({ id: "r3", addTagId: "срочно" }),
      ],
      "готово"
    );
    expect(patch.addTagIds).toEqual(["срочно", "релиз"]);
  });
});

describe("ruleHasAction", () => {
  it("правило без единого действия бессмысленно", () => {
    expect(ruleHasAction({})).toBe(false);
    expect(ruleHasAction({ setStatus: null, assignUserId: null, addTagId: null })).toBe(false);
  });

  it("любое действие делает правило осмысленным", () => {
    expect(ruleHasAction({ setStatus: "DONE" })).toBe(true);
    expect(ruleHasAction({ addTagId: "t" })).toBe(true);
  });
});

describe("describeRule", () => {
  it("описывает все действия правила одной фразой", () => {
    const text = describeRule(
      rule({ setStatus: "DONE", assignUserId: "u", addTagId: "t" }),
      { column: "Готово", status: "Готово", user: "Маша", tag: "релиз" }
    );
    expect(text).toContain("«Готово»");
    expect(text).toContain("Маша");
    expect(text).toContain("релиз");
  });

  it("правило без действий так и описывается", () => {
    expect(describeRule(rule(), { column: "Готово" })).toContain("ничего");
  });
});
