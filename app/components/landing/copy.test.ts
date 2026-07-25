import { describe, expect, it } from "vitest";
import { LANDING_CONTACT_EMAIL, talkToUsHref } from "./contact";
import { landingCopy, PRODUCT_SURFACES } from "./copy";

describe("landing copy honesty", () => {
  it("does not invent named customers or fake metrics", () => {
    const blob = JSON.stringify({ landingCopy, PRODUCT_SURFACES });
    expect(blob).not.toMatch(/Mayo|Cleveland Clinic|trusted by|NPS|ARR|readmission rate/i);
  });

  it("keeps US clinical register", () => {
    const blob = JSON.stringify(landingCopy);
    expect(blob).not.toMatch(/\bNHS\b|\bMum\b|\bring the\b/i);
  });

  it("exposes the four product surfaces with real routes", () => {
    const hrefs = PRODUCT_SURFACES.map((s) => s.href);
    expect(hrefs).toEqual(
      expect.arrayContaining(["/call", "/family", "/clinician", "/clinician/engine"]),
    );
  });

  it("builds a mailto for Talk to us", () => {
    expect(LANDING_CONTACT_EMAIL).toMatch(/@/);
    expect(talkToUsHref()).toMatch(/^mailto:/);
    expect(talkToUsHref()).toContain(LANDING_CONTACT_EMAIL);
  });
});
