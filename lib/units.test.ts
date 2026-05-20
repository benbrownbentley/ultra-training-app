import { describe, expect, it } from "vitest";
import {
  formatDistance,
  formatElevation,
  formatPace,
  formatWeight,
  parseDistance,
  parseElevation,
  parseWeight,
} from "@/lib/units";

describe("formatDistance", () => {
  it("displays whole km without trailing zero", () => {
    expect(formatDistance(8, "metric")).toBe("8 km");
  });
  it("displays fractional km with one decimal", () => {
    expect(formatDistance(7.5, "metric")).toBe("7.5 km");
  });
  it("converts km → mi for imperial", () => {
    // 10 km ≈ 6.21 mi → formatted as 6.2
    expect(formatDistance(10, "imperial")).toBe("6.2 mi");
  });
  it("accepts a string input", () => {
    expect(formatDistance("12.5", "metric")).toBe("12.5 km");
  });
  it("handles zero", () => {
    expect(formatDistance(0, "metric")).toBe("0 km");
    expect(formatDistance(0, "imperial")).toBe("0 mi");
  });
});

describe("formatElevation", () => {
  it("formats positive metric", () => {
    expect(formatElevation(220, "metric")).toBe("+220 m");
  });
  it("formats negative metric", () => {
    expect(formatElevation(-220, "metric")).toBe("-220 m");
  });
  it("converts m → ft for imperial", () => {
    // 100 m ≈ 328 ft
    expect(formatElevation(100, "imperial")).toBe("+328 ft");
  });
  it("handles zero with no sign", () => {
    expect(formatElevation(0, "metric")).toBe("0 m");
  });
});

describe("formatWeight", () => {
  it("formats kg", () => {
    expect(formatWeight(70, "metric")).toBe("70 kg");
  });
  it("converts kg → lb", () => {
    // 70 kg ≈ 154.3 lb → rounded to 154
    expect(formatWeight(70, "imperial")).toBe("154 lb");
  });
});

describe("formatPace", () => {
  // Pace math is easy to break silently — pin the conversion factors
  // here so a future refactor of lib/units constants fails loudly.
  it("formats metric pace", () => {
    // 5:00 /km
    expect(formatPace(300, "metric")).toBe("5:00 /km");
  });
  it("formats with zero-padded seconds", () => {
    // 4:05 /km
    expect(formatPace(245, "metric")).toBe("4:05 /km");
  });
  it("converts sec/km → sec/mi", () => {
    // 5:00 /km × 1.609344 = 482.8 sec/mi → 8:03 /mi
    expect(formatPace(300, "imperial")).toBe("8:03 /mi");
  });
  it("handles 6:00 /km → 9:39 /mi", () => {
    expect(formatPace(360, "imperial")).toBe("9:39 /mi");
  });
});

describe("parse round-trips", () => {
  it("parseDistance metric returns km verbatim", () => {
    expect(parseDistance("12", "metric")).toBeCloseTo(12, 5);
  });
  it("parseDistance imperial converts mi → km", () => {
    expect(parseDistance("10", "imperial")).toBeCloseTo(16.09344, 5);
  });
  it("parseElevation imperial converts ft → m", () => {
    // 328 ft ≈ 99.97 m
    expect(parseElevation("328", "imperial")).toBeCloseTo(99.97, 1);
  });
  it("parseWeight imperial converts lb → kg", () => {
    // 154 lb ≈ 69.85 kg
    expect(parseWeight("154", "imperial")).toBeCloseTo(69.85, 1);
  });
  it("non-numeric input parses to 0", () => {
    expect(parseDistance("abc", "metric")).toBe(0);
  });
});
