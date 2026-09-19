import { describe, it, expect } from "vitest";
import { DEFAULT_SKIN, isSkin, SKINS, skinScript } from "@/lib/skin";

/**
 * Скрипт из <head> исполняется до React и до гидратации, поэтому проверяем
 * его так же, как браузер: выполняем строку, подсунув свои localStorage и
 * document. Тесты идут в окружении node — настоящего DOM здесь нет и не надо.
 */
function runSkinScript(stored: string | null | (() => never)) {
  const attributes: Record<string, string> = {};
  const storage = {
    getItem() {
      if (typeof stored === "function") stored();
      return stored as string | null;
    },
  };
  const document = {
    documentElement: {
      setAttribute(name: string, value: string) {
        attributes[name] = value;
      },
    },
  };
  new Function("localStorage", "document", skinScript())(storage, document);
  return attributes["data-skin"];
}

describe("skinScript", () => {
  it("восстанавливает сохранённый выбор", () => {
    expect(runSkinScript("railway")).toBe("railway");
    expect(runSkinScript("linear")).toBe("linear");
  });

  it("без выбора ставит оформление по умолчанию", () => {
    expect(runSkinScript(null)).toBe(DEFAULT_SKIN);
  });

  it("не доверяет мусору в хранилище", () => {
    expect(runSkinScript("neon")).toBe(DEFAULT_SKIN);
  });

  it("ставит атрибут, даже если хранилище недоступно", () => {
    // Приватный режим и отключённые куки роняют getItem — страница всё равно
    // не должна остаться без атрибута, иначе она мигнёт чужой палитрой.
    expect(
      runSkinScript(() => {
        throw new Error("SecurityError");
      })
    ).toBe(DEFAULT_SKIN);
  });

  it("знает ровно те же скины, что и список для выбора", () => {
    for (const option of SKINS) {
      expect(runSkinScript(option.id)).toBe(option.id);
    }
  });
});

describe("isSkin", () => {
  it("пропускает только известные значения", () => {
    expect(isSkin("aurora")).toBe(true);
    expect(isSkin("linear")).toBe(true);
    expect(isSkin("railway")).toBe(true);
    expect(isSkin("dark")).toBe(false);
    expect(isSkin(null)).toBe(false);
  });
});

describe("SKINS", () => {
  it("оформление по умолчанию есть в списке выбора", () => {
    expect(SKINS.some((option) => option.id === DEFAULT_SKIN)).toBe(true);
  });
});
