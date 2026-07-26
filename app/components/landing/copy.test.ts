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

  it("points primary and secondary CTAs at clinician hub and patient portal", () => {
    expect(landingCopy.primaryCta).toBe("Open clinician hub");
    expect(landingCopy.secondaryCta).toBe("Patient portal");
    expect(landingCopy.primaryHref).toBe("/clinician");
    expect(landingCopy.secondaryHref).toBe("/patient");
  });

  it("keeps optional quiet deep links for judges", () => {
    const hrefs = PRODUCT_SURFACES.map((s) => s.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/clinician",
        "/clinician/margaret-ellison/capture",
        "/patient",
        "/family",
        "/clinician/engine",
      ]),
    );
    expect(PRODUCT_SURFACES.every((s) => s.quiet)).toBe(true);
  });

  it("uses Capture product language (not Ops)", () => {
    const blob = JSON.stringify({ landingCopy, PRODUCT_SURFACES });
    expect(blob).not.toMatch(/\bOps\b/);
    expect(landingCopy.devices.kardia.body).toMatch(/into Capture/);
  });

  it("builds a mailto for Talk to us in nav/footer", () => {
    expect(landingCopy.contactCta).toBe("Talk to us");
    expect(LANDING_CONTACT_EMAIL).toMatch(/@/);
    expect(talkToUsHref()).toMatch(/^mailto:/);
    expect(talkToUsHref()).toContain(LANDING_CONTACT_EMAIL);
  });

  it("exposes a Business case nav tab to the dedicated route", () => {
    expect(landingCopy.businessCaseCta).toBe("Business case");
    expect(landingCopy.businessCaseHref).toBe("/business-case");
  });
});
