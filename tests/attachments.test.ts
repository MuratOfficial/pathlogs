import { describe, it, expect } from "vitest";
import {
  embeddedFileIds,
  normalizeNewlines,
  fileEmbed,
  formatFileSize,
  insertEmbedAtCursor,
  isImageMime,
  splitDescription,
  stripFileEmbeds,
} from "@/lib/attachments";

describe("splitDescription", () => {
  it("текст без вставок остаётся одним куском", () => {
    expect(splitDescription("Просто описание\nв две строки")).toEqual([
      { kind: "text", text: "Просто описание\nв две строки" },
    ]);
  });

  it("вставка отдельной строкой разделяет текст", () => {
    expect(
      splitDescription("До картинки\n\n[[file:abc123]]\n\nПосле картинки")
    ).toEqual([
      { kind: "text", text: "До картинки\n" },
      { kind: "file", id: "abc123" },
      { kind: "text", text: "\nПосле картинки" },
    ]);
  });

  it("вставка посреди строки остаётся текстом", () => {
    // Иначе вставка рвала бы абзац надвое, а разбор markdown получал бы
    // половинки списков и блоков кода.
    expect(splitDescription("смотри [[file:abc123]] тут")).toEqual([
      { kind: "text", text: "смотри [[file:abc123]] тут" },
    ]);
  });

  it("пробелы вокруг вставки допустимы", () => {
    expect(splitDescription("  [[file:abc]]  ")).toEqual([
      { kind: "file", id: "abc" },
    ]);
  });

  it("пустое описание не даёт ни одного куска", () => {
    expect(splitDescription("")).toEqual([]);
    expect(splitDescription("\n\n  \n")).toEqual([]);
  });

  it("подделки под вставку разбору не поддаются", () => {
    // id — только буквы, цифры, дефис и подчёркивание: ни пути, ни адреса,
    // ни кавычек в нём оказаться не может.
    for (const fake of [
      "[[file:../../etc/passwd]]",
      "[[file:https://evil.test/x.png]]",
      "[[file:]]",
      "[[file:abc def]]",
    ]) {
      expect(splitDescription(fake)).toEqual([{ kind: "text", text: fake }]);
    }
  });

  it("несколько вставок идут подряд в порядке текста", () => {
    const text = `${fileEmbed("one")}\n${fileEmbed("two")}\n${fileEmbed("one")}`;
    expect(splitDescription(text).filter((s) => s.kind === "file")).toHaveLength(3);
    expect(embeddedFileIds(text)).toEqual(["one", "two"]);
  });
});

describe("stripFileEmbeds", () => {
  it("оставляет только текст", () => {
    expect(
      stripFileEmbeds("Начало\n\n[[file:abc]]\n\nКонец")
    ).toBe("Начало\n\nКонец");
  });

  it("описание из одной вставки превращается в пустую строку", () => {
    expect(stripFileEmbeds("[[file:abc]]")).toBe("");
  });
});

describe("insertEmbedAtCursor", () => {
  it("в пустой текст вставка попадает без лишних переводов строки", () => {
    const r = insertEmbedAtCursor("", "[[file:a]]", 0);
    expect(r.text).toBe("[[file:a]]\n");
    expect(r.cursor).toBe(r.text.length);
  });

  it("вставка в середину абзаца отделяется пустыми строками", () => {
    const r = insertEmbedAtCursor("доабц", "[[file:a]]", 2);
    expect(r.text).toBe("до\n\n[[file:a]]\n\nабц");
    // Курсор остаётся сразу за вставкой — можно продолжать писать
    expect(r.text.slice(0, r.cursor)).toBe("до\n\n[[file:a]]\n\n");
  });

  it("на пустой строке лишние переводы не добавляются", () => {
    const r = insertEmbedAtCursor("текст\n\n", "[[file:a]]", 7);
    expect(r.text).toBe("текст\n\n[[file:a]]\n");
  });

  it("вставленное читается разбором как вставка", () => {
    const r = insertEmbedAtCursor("было", fileEmbed("xyz"), 4);
    expect(embeddedFileIds(r.text)).toEqual(["xyz"]);
  });

  it("курсор за пределами текста не ломает вставку", () => {
    expect(insertEmbedAtCursor("абв", "[[file:a]]", 999).text).toBe(
      "абв\n\n[[file:a]]\n"
    );
    expect(insertEmbedAtCursor("абв", "[[file:a]]", -5).text).toBe(
      "[[file:a]]\n\nабв"
    );
  });
});

describe("isImageMime", () => {
  it("растровые картинки показываются превью", () => {
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("image/jpeg")).toBe(true);
    expect(isImageMime("image/webp")).toBe(true);
  });

  it("svg и прочие файлы — нет", () => {
    expect(isImageMime("image/svg+xml")).toBe(false);
    expect(isImageMime("application/pdf")).toBe(false);
    expect(isImageMime("text/plain")).toBe(false);
  });
});

describe("formatFileSize", () => {
  it("мелкий файл — не меньше килобайта", () => {
    expect(formatFileSize(0)).toBe("1 КБ");
    expect(formatFileSize(900)).toBe("1 КБ");
  });

  it("килобайты и мегабайты", () => {
    expect(formatFileSize(300 * 1024)).toBe("300 КБ");
    expect(formatFileSize(Math.round(1.5 * 1024 ** 2))).toBe("1.5 МБ");
    expect(formatFileSize(25 * 1024 ** 2)).toBe("25 МБ");
  });
});

describe("normalizeNewlines", () => {
  it("убирает возврат каретки из текста, пришедшего формой", () => {
    expect(normalizeNewlines("первая\r\nвторая\r\n")).toBe(
      "первая\nвторая\n"
    );
  });

  it("длина совпадает с тем, что видит textarea", () => {
    // Из-за этой разницы вставка файла попадала не на место курсора:
    // в состоянии текста был лишний символ, а selectionStart его не считал.
    const fromForm = "строка\r\n\r\nещё";
    expect(normalizeNewlines(fromForm).length).toBe(fromForm.length - 2);
  });

  it("уже нормальный текст не меняется", () => {
    expect(normalizeNewlines("абв\nгде")).toBe("абв\nгде");
  });
});
