import { describe, it, expect } from "vitest";
import {
  DEFAULT_QUOTA_BYTES,
  fitsInQuota,
  formatBytes,
  quotaLimitBytes,
  quotaState,
} from "@/lib/storageQuota";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

describe("fitsInQuota", () => {
  it("пропускает файл, если место есть", () => {
    expect(fitsInQuota(5 * GB, 10 * MB, 10 * GB)).toBe(true);
  });

  it("файл ровно до границы ещё проходит", () => {
    expect(fitsInQuota(10 * GB - MB, MB, 10 * GB)).toBe(true);
  });

  it("файл, выходящий за границу, отбивается", () => {
    expect(fitsInQuota(10 * GB - MB, 2 * MB, 10 * GB)).toBe(false);
  });

  it("при уже исчерпанной квоте не проходит ничего", () => {
    expect(fitsInQuota(11 * GB, 1, 10 * GB)).toBe(false);
  });
});

describe("quotaState", () => {
  it("считает остаток и долю", () => {
    const s = quotaState(5 * GB, 10 * GB);
    expect(s.free).toBe(5 * GB);
    expect(s.ratio).toBeCloseTo(0.5);
    expect(s.nearLimit).toBe(false);
  });

  it("с 90 % занятого поднимает флаг", () => {
    expect(quotaState(9 * GB, 10 * GB).nearLimit).toBe(true);
  });

  it("перерасход не даёт отрицательного остатка", () => {
    expect(quotaState(12 * GB, 10 * GB).free).toBe(0);
  });
});

describe("quotaLimitBytes", () => {
  it("по умолчанию — бесплатные 10 ГБ R2", () => {
    delete process.env.STORAGE_QUOTA_BYTES;
    expect(quotaLimitBytes()).toBe(DEFAULT_QUOTA_BYTES);
  });

  it("переопределяется переменной окружения", () => {
    process.env.STORAGE_QUOTA_BYTES = String(50 * GB);
    expect(quotaLimitBytes()).toBe(50 * GB);
    delete process.env.STORAGE_QUOTA_BYTES;
  });

  it("мусор в переменной игнорируется", () => {
    process.env.STORAGE_QUOTA_BYTES = "много";
    expect(quotaLimitBytes()).toBe(DEFAULT_QUOTA_BYTES);
    delete process.env.STORAGE_QUOTA_BYTES;
  });
});

describe("formatBytes", () => {
  it("показывает гигабайты с десятыми", () => {
    expect(formatBytes(9.5 * GB)).toBe("9.5 ГБ");
  });

  it("мелкие файлы не схлопываются в 0", () => {
    expect(formatBytes(200)).toBe("1 КБ");
  });
});
