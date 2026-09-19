import { describe, it, expect } from "vitest";
import path from "node:path";
import { localFilePath } from "@/lib/storage";

const UPLOADS = path.resolve(process.cwd(), "uploads");

describe("localFilePath", () => {
  it("обычный ключ превращается в путь внутри uploads", () => {
    expect(localFilePath("1234-abcdef-отчёт.txt")).toBe(
      path.join(UPLOADS, "1234-abcdef-отчёт.txt")
    );
  });

  it("выход вверх по дереву отклоняется", () => {
    expect(() => localFilePath("../.env")).toThrow("Недопустимый путь");
    expect(() => localFilePath("../../etc/passwd")).toThrow("Недопустимый путь");
  });

  // Абсолютный путь строим через path.resolve, а не записываем строкой: на
  // Windows абсолютное начинается с C:\, на Linux — с /, и жёстко вписанный
  // "C:\Windows\win.ini" в CI оказывался просто именем файла с обратными
  // слэшами — то есть законным ключом внутри uploads.
  it("абсолютный путь не подменяет хранилище", () => {
    const outside = path.resolve(UPLOADS, "..", "секрет.txt");
    expect(path.isAbsolute(outside)).toBe(true);
    expect(() => localFilePath(outside)).toThrow("Недопустимый путь");
  });

  it("корневой путь отклоняется на любой ОС", () => {
    // На Linux это /etc/passwd, на Windows — C:\etc\passwd: и то и другое
    // лежит вне хранилища.
    expect(() => localFilePath("/etc/passwd")).toThrow("Недопустимый путь");
  });

  // Регрессия: голый startsWith("…/uploads") пропускал соседнюю папку, которая
  // начинается тем же префиксом, но лежит уже вне хранилища.
  it("соседняя папка с тем же префиксом отклоняется", () => {
    expect(() => localFilePath("../uploads-чужое/секрет.txt")).toThrow(
      "Недопустимый путь"
    );
  });

  it("пустой ключ не отдаёт саму папку хранилища", () => {
    expect(() => localFilePath("")).toThrow("Недопустимый путь");
  });
});
