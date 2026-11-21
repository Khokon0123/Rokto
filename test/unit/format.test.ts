import { describe, expect, it } from "vitest";
import { formatDate, isCoolingDown } from "@/lib/donation";
import { formatDistanceKm, getCurrentPosition } from "@/lib/geo";

describe("formatting", () => {
  it("dates follow the page language", () => {
    const d = new Date("2026-06-12T00:00:00Z");
    expect(formatDate(d, "en")).toBe("12 Jun 2026");
    expect(formatDate(d, "bn")).toMatch(/১২/);
  });
  it("cooldown is 90 days", () => {
    const now = Date.parse("2026-10-31T00:00:00Z");
    expect(isCoolingDown(new Date("2026-10-01T00:00:00Z"), now)).toBe(true);
    expect(isCoolingDown(new Date("2026-07-01T00:00:00Z"), now)).toBe(false);
    expect(isCoolingDown(null, now)).toBe(false);
  });
  it("distances", () => {
    expect(formatDistanceKm(0.45, "en")).toBe("450 m");
    expect(formatDistanceKm(3.24, "en")).toBe("3.2 km");
    expect(formatDistanceKm(12.6, "en")).toBe("13 km");
    expect(formatDistanceKm(Infinity, "en")).toBe("");
    expect(formatDistanceKm(2.4, "bn")).toMatch(/২/);
  });
  it("geolocation without browser support rejects", async () => {
    await expect(getCurrentPosition()).rejects.toThrow("geolocation_unsupported");
  });
});

describe("donation count", () => {
  it("empty is 'not given'; 0-200 whole numbers pass; the rest is invalid", async () => {
    const { parseDonationCount } = await import("@/lib/validation");
    expect(parseDonationCount("")).toBeNull();
    expect(parseDonationCount(null)).toBeNull();
    expect(parseDonationCount("0")).toBe(0);
    expect(parseDonationCount(" 7 ".trim())).toBe(7);
    expect(parseDonationCount(200)).toBe(200);
    for (const bad of ["201", "-1", "2.5", "abc", 1.5, 999, {}, true]) expect(parseDonationCount(bad)).toBeUndefined();
  });
});
