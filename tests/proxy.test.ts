import { describe, it, expect, beforeEach, vi } from "vitest";

// proxy интересует только факт входа, а не содержимое JWT — подменяем целиком,
// иначе тесту понадобились бы настоящие куки и AUTH_SECRET.
const jwtState: { token: unknown } = { token: null };
vi.mock("next-auth/jwt", () => ({
  getToken: async () => jwtState.token,
}));

import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/** Куда proxy уводит запрос; null — пропустил дальше, к самой странице. */
async function redirectFor(path: string): Promise<string | null> {
  const res = await proxy(new NextRequest(new URL(`http://localhost${path}`)));
  return res.headers.get("location");
}

function loggedIn() {
  jwtState.token = { id: "user-1", role: "DEVELOPER" };
}

beforeEach(() => {
  jwtState.token = null;
});

describe("proxy: страницы по ссылке с токеном", () => {
  // Регрессия: /intake не был в PUBLIC_PATHS, и заявку не мог оставить никто —
  // заполняющего уводило на /login, хотя учётной записи у него нет и не будет.
  it("анонимный посетитель доходит до формы заявок", async () => {
    expect(await redirectFor("/intake/some-token")).toBeNull();
  });

  it("анонимный посетитель доходит до публичного роадмапа", async () => {
    expect(await redirectFor("/roadmap/some-token")).toBeNull();
  });

  it("залогиненного с этих страниц не уводит: ссылку могут открыть и свои", async () => {
    loggedIn();
    expect(await redirectFor("/intake/some-token")).toBeNull();
    expect(await redirectFor("/roadmap/some-token")).toBeNull();
  });
});

describe("proxy: закрытая часть", () => {
  it("анонимного уводит на вход и помнит, куда он шёл", async () => {
    const location = await redirectFor("/dashboard");
    expect(location).not.toBeNull();
    const url = new URL(location!);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("callbackUrl")).toBe("/dashboard");
  });

  it("залогиненного пускает", async () => {
    loggedIn();
    expect(await redirectFor("/dashboard")).toBeNull();
  });

  it("залогиненного уводит со страниц входа и регистрации", async () => {
    loggedIn();
    expect(await redirectFor("/login")).toContain("/dashboard");
    expect(await redirectFor("/register")).toContain("/dashboard");
  });

  it("анонимного на страницах входа и регистрации оставляет", async () => {
    expect(await redirectFor("/login")).toBeNull();
    expect(await redirectFor("/register")).toBeNull();
  });
});
