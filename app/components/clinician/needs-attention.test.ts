import { describe, expect, it } from "vitest";
import { pickNeedsAttention } from "./needs-attention";

function p(id: string, level: "green" | "amber" | "red") {
  return { id, latest: { decision: { level } } };
}

describe("pickNeedsAttention", () => {
  it("keeps only red and amber, in given order, up to limit", () => {
    const input = [
      p("a", "red"),
      p("b", "amber"),
      p("c", "green"),
      p("d", "amber"),
    ];
    expect(pickNeedsAttention(input, 2).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("returns empty when panel is all green", () => {
    expect(pickNeedsAttention([p("a", "green")], 5)).toEqual([]);
  });
});
