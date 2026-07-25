import { describe, expect, it } from "vitest";
import { resolvePhoneFramed } from "./PhoneFrame";

describe("resolvePhoneFramed", () => {
  it("defaults to framed", () => {
    expect(resolvePhoneFramed(undefined)).toBe(true);
  });

  it("disables on frame=0 / false / off", () => {
    expect(resolvePhoneFramed("0")).toBe(false);
    expect(resolvePhoneFramed("false")).toBe(false);
    expect(resolvePhoneFramed("off")).toBe(false);
    expect(resolvePhoneFramed(["0"])).toBe(false);
  });

  it("keeps framed for other values", () => {
    expect(resolvePhoneFramed("1")).toBe(true);
    expect(resolvePhoneFramed("on")).toBe(true);
  });
});
