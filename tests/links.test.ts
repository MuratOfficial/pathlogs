import { describe, it, expect } from "vitest";
import { normalizeUrl, linkHost } from "@/lib/url";

describe("normalizeUrl", () => {
  it("оставляет http и https как есть", () => {
    expect(normalizeUrl("https://example.com/doc")).toBe("https://example.com/doc");
    expect(normalizeUrl("http://example.com/")).toBe("http://example.com/");
  });

  it("дописывает https к адресу без схемы", () => {
    expect(normalizeUrl("example.com/doc")).toBe("https://example.com/doc");
    expect(normalizeUrl("  figma.com/file/abc  ")).toBe("https://figma.com/file/abc");
  });

  it("отсекает опасные схемы — ссылка рендерится как <a href>", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("JavaScript:alert(1)")).toBeNull();
    expect(normalizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(normalizeUrl("vbscript:msgbox(1)")).toBeNull();
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
  });

  it("отбраковывает пустое и заведомо некорректное", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl("https://")).toBeNull();
    expect(normalizeUrl(`https://example.com/${"a".repeat(2100)}`)).toBeNull();
  });
});

describe("linkHost", () => {
  it("возвращает хост без www", () => {
    expect(linkHost("https://www.example.com/a/b")).toBe("example.com");
    expect(linkHost("https://docs.google.com/x")).toBe("docs.google.com");
  });
});
