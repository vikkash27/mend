import { describe, expect, it } from "vitest";
import { BUSINESS_CASE_HREF, businessCaseCopy } from "./copy";

describe("business case copy", () => {
  it("uses the dedicated route", () => {
    expect(BUSINESS_CASE_HREF).toBe("/business-case");
    expect(businessCaseCopy.navLabel).toBe("Business case");
  });

  it("answers investor and consumer questions", () => {
    expect(businessCaseCopy.buyers.title.length).toBeGreaterThan(10);
    expect(businessCaseCopy.consumers.title).toMatch(/phone|app/i);
    expect(businessCaseCopy.thesis.title).toMatch(/capacity/i);
  });

  it("labels economics as illustrative, not customer results", () => {
    expect(businessCaseCopy.economics.caveat).toMatch(/illustrative/i);
    expect(businessCaseCopy.economics.caveat).toMatch(/not forecasts/i);
    expect(businessCaseCopy.close.figuresNote).toMatch(/illustrative/i);
  });

  it("does not invent named customers or trusted-by claims", () => {
    const blob = JSON.stringify(businessCaseCopy);
    expect(blob).not.toMatch(
      /Mayo|Cleveland Clinic|trusted by|NPS|\bARR\b/i,
    );
  });

  it("keeps US clinical register", () => {
    const blob = JSON.stringify(businessCaseCopy);
    expect(blob).not.toMatch(/\bNHS\b|\bMum\b|\bring the\b/i);
  });

  it("points CTAs at real product surfaces", () => {
    expect(businessCaseCopy.hero.primaryHref).toBe("/clinician");
    expect(businessCaseCopy.close.primaryHref).toBe("/clinician");
    expect(businessCaseCopy.hero.secondaryHref).toBe("/");
  });
});
