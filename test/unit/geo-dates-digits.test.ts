import { afterEach, describe, expect, it, vi } from "vitest";
import { dhakaDate, todayIso } from "@/lib/dates";
import { onlyDigits, toLatinDigits } from "@/lib/digits";
import { haversineKm, isValidGeoPoint, snapGeoPoint } from "@/lib/geo";
import { normalizeBdPhone, formatLocalPhone } from "@/lib/phone";
import { cleanName, parseDateOnly } from "@/lib/validation";

afterEach(() => vi.useRealTimers());

describe("S5: location snapping", () => {
  it("the same home saved 100 times gives ONE public point", () => {
    const home = { lat: 22.3569, lng: 91.7832 };
    const points = new Set(Array.from({ length: 100 }, () => JSON.stringify(snapGeoPoint(home, 500))));
    expect(points.size).toBe(1);
  });
  it("nearby positions inside a cell collapse to the same point; cells are >= ~400 m apart", () => {
    const a = snapGeoPoint({ lat: 22.35, lng: 91.78 }, 500);
    const b = snapGeoPoint({ lat: 22.35 + 0.006, lng: 91.78 }, 500); // ~670 m north
    expect(haversineKm(a, b)).toBeGreaterThan(0.4);
    const jitter = snapGeoPoint({ lat: a.lat + 0.0001, lng: a.lng - 0.0001 }, 500);
    expect(jitter).toEqual(a);
  });
  it("a snapped point is within one cell of the original", () => {
    const p = { lat: 22.4012, lng: 91.8123 };
    expect(haversineKm(p, snapGeoPoint(p, 500))).toBeLessThan(0.5);
    expect(isValidGeoPoint(snapGeoPoint(p, 500))).toBe(true);
  });
});

describe("F11/D6: Bangladesh dates", () => {
  it("between 00:00 and 06:00 Dhaka time, today is already the new day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T19:30:00Z")); // 01:30 on 31 Oct in Dhaka
    expect(todayIso()).toBe("2026-10-31");
    expect(dhakaDate()).toBe("2026-10-31");
  });
  it("parseDateOnly accepts Dhaka-today and rejects tomorrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T19:30:00Z"));
    expect(parseDateOnly("2026-10-31")).not.toBeNull();
    expect(parseDateOnly("2026-11-01")).toBeNull();
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("1899-01-01")).toBeNull();
    expect(parseDateOnly("31-10-2026")).toBeNull();
  });
});

describe("E1: Bengali digits", () => {
  it("converts ০-৯ and keeps only digits", () => {
    expect(toLatinDigits("০১২৩৪৫৬৭৮৯")).toBe("0123456789");
    expect(onlyDigits("১২৩ ৪৫৬")).toBe("123456");
    expect(onlyDigits("12a3-4")).toBe("1234");
  });
  it("phones in either script normalise to E.164", () => {
    expect(normalizeBdPhone("০১৭১২৩৪৫৬৭৮")).toBe("+8801712345678");
    expect(normalizeBdPhone("+880 1712-345678")).toBe("+8801712345678");
    expect(normalizeBdPhone("01212345678")).toBeNull();
    expect(formatLocalPhone("+8801712345678")).toBe("01712345678");
  });
});

describe("validation", () => {
  it("cleanName trims and bounds", () => {
    expect(cleanName("  Rahim   Uddin ")).toBe("Rahim Uddin");
    expect(cleanName("a")).toBeNull();
    expect(cleanName("x".repeat(81))).toBeNull();
    expect(cleanName(5)).toBeNull();
  });
});
