import { describe, expect, it } from "vitest";
import { shouldApplyPollResponse } from "./use-live-call-feed";

describe("shouldApplyPollResponse", () => {
  it("applies when the response generation matches the latest", () => {
    expect(shouldApplyPollResponse(3, 3)).toBe(true);
  });

  it("ignores stale responses from an earlier generation", () => {
    expect(shouldApplyPollResponse(2, 5)).toBe(false);
  });

  it("ignores responses from a future generation", () => {
    expect(shouldApplyPollResponse(6, 5)).toBe(false);
  });
});
