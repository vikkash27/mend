import { describe, it, expect } from "vitest";
import { generateExtractionCorpus, generateVignettes, rng } from "./generate";

describe("generator determinism", () => {
  it("same seed produces an identical corpus", () => {
    expect(generateExtractionCorpus(50, 42)).toEqual(
      generateExtractionCorpus(50, 42),
    );
    expect(generateVignettes(50, 42)).toEqual(generateVignettes(50, 42));
  });

  it("different seeds produce different corpora", () => {
    expect(generateExtractionCorpus(50, 1)).not.toEqual(
      generateExtractionCorpus(50, 2),
    );
  });

  it("rng is stable across calls with the same seed", () => {
    const a = rng(7);
    const b = rng(7);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });
});

