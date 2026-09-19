import { describe, it, expect } from "vitest";
import { DEFAULT_SIDEBAR, isSidebarState, sidebarScript } from "@/lib/sidebar";

/**
 * Скрипт из <head> исполняется до React, поэтому проверяем его так же, как
 * браузер: выполняем строку, подсунув свои localStorage и document.
 */
function runSidebarScript(stored: string | null | (() => never)) {
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
  new Function("localStorage", "document", sidebarScript())(storage, document);
  return attributes["data-sidebar"];
}

describe("sidebarScript", () => {
  it("восстанавливает свёрнутое меню", () => {
    expect(runSidebarScript("hidden")).toBe("hidden");
  });

  it("без выбора оставляет меню открытым", () => {
    expect(runSidebarScript(null)).toBe(DEFAULT_SIDEBAR);
    expect(DEFAULT_SIDEBAR).toBe("open");
  });

  it("не доверяет мусору в хранилище", () => {
    expect(runSidebarScript("collapsed")).toBe(DEFAULT_SIDEBAR);
  });

  it("ставит атрибут, даже если хранилище недоступно", () => {
    // Без атрибута CSS не знает состояния, и свёрнутое меню мигнуло бы
    // на экране до гидратации.
    expect(
      runSidebarScript(() => {
        throw new Error("SecurityError");
      })
    ).toBe(DEFAULT_SIDEBAR);
  });
});

describe("isSidebarState", () => {
  it("пропускает только известные значения", () => {
    expect(isSidebarState("open")).toBe(true);
    expect(isSidebarState("hidden")).toBe(true);
    expect(isSidebarState("collapsed")).toBe(false);
    expect(isSidebarState(null)).toBe(false);
  });
});
