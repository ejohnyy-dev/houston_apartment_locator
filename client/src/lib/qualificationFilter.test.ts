import { describe, expect, it } from "vitest";
import {
  getMatchResult,
  getMatchTier,
  parseBudgetRange,
  rankApartments,
  type ApartmentData,
} from "./qualificationFilter";
import type { QualificationData } from "@/components/QualificationPrompt";

function prefs(overrides: Partial<QualificationData> = {}): QualificationData {
  return {
    preferredAreas: [],
    moveInTimeline: "1-3-months",
    bedrooms: "",
    bathrooms: "",
    budget: "",
    pets: [],
    ...overrides,
  };
}

function apt(overrides: Partial<ApartmentData> = {}): ApartmentData {
  return {
    id: 1,
    name: "Apartment in Katy",
    neighborhood: "Katy",
    bedrooms: 2,
    rentMin: 1500,
    rentMax: 1500,
    ...overrides,
  };
}

describe("parseBudgetRange", () => {
  it("parses the BudgetRangeSelector string format", () => {
    expect(parseBudgetRange("$1000-2000")).toEqual({ min: 1000, max: 2000 });
    expect(parseBudgetRange("$0-1500")).toEqual({ min: 0, max: 1500 });
  });

  it("parses the object format", () => {
    expect(parseBudgetRange({ min: 800, max: 1600 })).toEqual({ min: 800, max: 1600 });
    expect(parseBudgetRange({ min: null, max: 1600 })).toEqual({ min: 0, max: 1600 });
  });

  it("parses legacy preset values", () => {
    expect(parseBudgetRange("1500-2000")).toEqual({ min: 1500, max: 2000 });
    expect(parseBudgetRange("3000-plus")).toEqual({ min: 3000, max: 100000 });
  });
});

describe("getMatchResult", () => {
  it("scores 100 when budget, bedrooms, and area all match", () => {
    const result = getMatchResult(
      apt(),
      prefs({ budget: "$1000-2000", bedrooms: "2bed", preferredAreas: ["Katy"] })
    );
    expect(result.score).toBe(100);
    expect(result.reasons).toEqual([
      "Fits your budget",
      "Right bedroom count",
      "Preferred area",
    ]);
  });

  it("normalizes over answered questions only", () => {
    // Only budget answered and it matches → full score
    const result = getMatchResult(apt(), prefs({ budget: "$1000-2000" }));
    expect(result.score).toBe(100);
  });

  it("returns 0 when nothing was answered", () => {
    expect(getMatchResult(apt(), prefs()).score).toBe(0);
  });

  it("gives partial credit when the price is within 15% over budget", () => {
    const inRange = getMatchResult(
      apt({ rentMin: 2000, rentMax: 2000 }),
      prefs({ budget: "$1000-2000" })
    );
    const slightlyOver = getMatchResult(
      apt({ rentMin: 2200, rentMax: 2200 }),
      prefs({ budget: "$1000-2000" })
    );
    const farOver = getMatchResult(
      apt({ rentMin: 3000, rentMax: 3000 }),
      prefs({ budget: "$1000-2000" })
    );
    expect(inRange.score).toBe(100);
    expect(slightlyOver.score).toBe(50);
    expect(slightlyOver.reasons).not.toContain("Fits your budget");
    expect(farOver.score).toBe(0);
  });

  it("gives partial credit when the price is just under the minimum budget", () => {
    const justUnder = getMatchResult(
      apt({ rentMin: 1800, rentMax: 1800 }),
      prefs({ budget: "$2000-3000" })
    );
    expect(justUnder.score).toBe(50);
  });

  it("compares against the average of the listing's price range", () => {
    // avg of 1800–2600 is 2200, outside $1000–$2000 but within 15%
    const result = getMatchResult(
      apt({ rentMin: 1800, rentMax: 2600 }),
      prefs({ budget: "$1000-2000" })
    );
    expect(result.score).toBe(50);
  });

  it("uses the per-bedroom price split when the renter wants that size", () => {
    // Listing-wide range is out of budget, but the 1BR split fits
    const result = getMatchResult(
      apt({ rentMin: 1200, rentMax: 3500, price1brMin: 1300, price1brMax: 1500 }),
      prefs({ budget: "$1000-1600", bedrooms: "1bed" })
    );
    expect(result.reasons).toContain("Fits your budget");
  });

  it("earns no budget points for unpriced listings", () => {
    const result = getMatchResult(
      apt({ rentMin: 0, rentMax: null }),
      prefs({ budget: "$1000-2000", preferredAreas: ["Katy"] })
    );
    // 0/40 budget + 30/30 area = 30/70
    expect(result.score).toBe(Math.round((30 / 70) * 100));
  });

  it("gives partial credit for one bedroom off", () => {
    const oneOff = getMatchResult(apt({ bedrooms: 3 }), prefs({ bedrooms: "2bed" }));
    const twoOff = getMatchResult(apt({ bedrooms: 4 }), prefs({ bedrooms: "2bed" }));
    expect(oneOff.score).toBe(50);
    expect(oneOff.reasons).not.toContain("Right bedroom count");
    expect(twoOff.score).toBe(0);
  });

  it("treats 4plus as four or more bedrooms", () => {
    expect(getMatchResult(apt({ bedrooms: 5 }), prefs({ bedrooms: "4plus" })).score).toBe(100);
    expect(getMatchResult(apt({ bedrooms: 3 }), prefs({ bedrooms: "4plus" })).score).toBe(50);
    expect(getMatchResult(apt({ bedrooms: 1 }), prefs({ bedrooms: "4plus" })).score).toBe(0);
  });

  it("matches studios", () => {
    expect(getMatchResult(apt({ bedrooms: 0 }), prefs({ bedrooms: "studio" })).score).toBe(100);
  });

  it("scores preferred areas", () => {
    const inArea = getMatchResult(apt(), prefs({ preferredAreas: ["Katy", "Heights"] }));
    const outOfArea = getMatchResult(
      apt({ neighborhood: "Pearland" }),
      prefs({ preferredAreas: ["Katy", "Heights"] })
    );
    expect(inArea.score).toBe(100);
    expect(inArea.reasons).toContain("Preferred area");
    expect(outOfArea.score).toBe(0);
  });
});

describe("getMatchTier", () => {
  it("maps scores to display tiers", () => {
    expect(getMatchTier(100)).toBe("great");
    expect(getMatchTier(75)).toBe("great");
    expect(getMatchTier(74)).toBe("good");
    expect(getMatchTier(45)).toBe("good");
    expect(getMatchTier(44)).toBeNull();
    expect(getMatchTier(0)).toBeNull();
  });
});

describe("rankApartments", () => {
  const answers = prefs({
    budget: "$1000-2000",
    bedrooms: "2bed",
    preferredAreas: ["Katy"],
  });

  it("orders listings best match first", () => {
    const perfect = apt({ id: "perfect" });
    const wrongArea = apt({ id: "wrong-area", neighborhood: "Pearland" });
    const wrongEverything = apt({
      id: "wrong-everything",
      neighborhood: "Pearland",
      bedrooms: 4,
      rentMin: 5000,
      rentMax: 5000,
    });

    const ranked = rankApartments([wrongEverything, wrongArea, perfect], answers);
    expect(ranked.map(r => r.apartment.id)).toEqual([
      "perfect",
      "wrong-area",
      "wrong-everything",
    ]);
  });

  it("keeps the original order for tied scores", () => {
    const a = apt({ id: "a" });
    const b = apt({ id: "b" });
    const ranked = rankApartments([a, b], answers);
    expect(ranked.map(r => r.apartment.id)).toEqual(["a", "b"]);
  });
});
