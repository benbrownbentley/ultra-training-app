import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatLongDate,
  parseISO,
  shortWeekday,
  weekStart,
} from "@/lib/utils";

describe("parseISO", () => {
  it("parses YYYY-MM-DD to a UTC Date", () => {
    const d = parseISO("2026-05-20");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(4); // 0-indexed
    expect(d.getUTCDate()).toBe(20);
  });
});

describe("daysBetween", () => {
  it("counts whole days forward", () => {
    expect(daysBetween("2026-05-01", "2026-05-10")).toBe(9);
  });
  it("returns negative for backwards", () => {
    expect(daysBetween("2026-05-10", "2026-05-01")).toBe(-9);
  });
  it("survives DST boundary (US spring forward 2026-03-08)", () => {
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });
  it("survives year boundary", () => {
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
  });
  it("survives leap-year February", () => {
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });
});

describe("addDays", () => {
  it("adds positive", () => {
    expect(addDays("2026-05-15", 7)).toBe("2026-05-22");
  });
  it("adds negative", () => {
    expect(addDays("2026-05-15", -7)).toBe("2026-05-08");
  });
  it("wraps month boundary", () => {
    expect(addDays("2026-01-30", 5)).toBe("2026-02-04");
  });
  it("survives leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });
});

describe("weekStart", () => {
  it("returns Monday of the week (Sunday → previous Mon)", () => {
    // 2026-05-17 is a Sunday. Monday of that week is 2026-05-11.
    expect(weekStart("2026-05-17")).toBe("2026-05-11");
  });
  it("returns Monday of the week (Wednesday → same-week Mon)", () => {
    // 2026-05-20 is a Wednesday.
    expect(weekStart("2026-05-20")).toBe("2026-05-18");
  });
  it("returns same date if input is already Monday", () => {
    expect(weekStart("2026-05-18")).toBe("2026-05-18");
  });
});

describe("shortWeekday", () => {
  it("returns 3-letter abbreviation", () => {
    expect(shortWeekday("2026-05-20")).toBe("Wed");
  });
});

describe("formatLongDate", () => {
  it("formats human-readable long date", () => {
    expect(formatLongDate("2026-05-20")).toMatch(/Wednesday|Wed/);
    expect(formatLongDate("2026-05-20")).toContain("May");
    expect(formatLongDate("2026-05-20")).toContain("20");
  });
});
