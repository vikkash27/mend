import { describe, it, expect } from "vitest";
import { scoreOhs, ohsChange, OHS_ITEMS, OhsAnswers } from "./ohs";

/** Every item answered with the same option index. */
const allAt = (optionIndex: number): OhsAnswers =>
  Object.fromEntries(OHS_ITEMS.map((i) => [i.id, optionIndex]));

describe("the instrument itself", () => {
  it("has exactly twelve items", () => {
    expect(OHS_ITEMS).toHaveLength(12);
  });

  it("gives every item five options", () => {
    for (const i of OHS_ITEMS) expect(i.options).toHaveLength(5);
  });

  it("uses unique item ids, so answers cannot silently collide", () => {
    expect(new Set(OHS_ITEMS.map((i) => i.id)).size).toBe(12);
  });
});

describe("scoreOhs — the 0–48 scale", () => {
  it("scores the best possible answers as 48", () => {
    const r = scoreOhs(allAt(0));
    expect(r.total).toBe(48);
    expect(r.band).toBe("satisfactory");
  });

  it("scores the worst possible answers as 0", () => {
    const r = scoreOhs(allAt(4));
    expect(r.total).toBe(0);
    expect(r.band).toBe("severe");
  });

  /**
   * Guards the direction of the scale. The original OHS scored 1–5 per item
   * (12–60, lower better) and the modern version scores 0–48 higher-better;
   * inverting them is a silent error that still produces a plausible number.
   */
  it("scores higher for better answers, not lower", () => {
    expect(scoreOhs(allAt(0)).total!).toBeGreaterThan(scoreOhs(allAt(4)).total!);
    expect(scoreOhs(allAt(1)).total!).toBeGreaterThan(scoreOhs(allAt(3)).total!);
  });

  it("scores a mid answer on every item as 24", () => {
    expect(scoreOhs(allAt(2)).total).toBe(24);
  });

  it("weights every item equally", () => {
    const totals = OHS_ITEMS.map((i) => scoreOhs({ ...allAt(0), [i.id]: 4 }).total);
    expect(new Set(totals).size).toBe(1);
    expect(totals[0]).toBe(44);
  });
});

describe("scoreOhs — band boundaries", () => {
  const bandAt = (total: number) => {
    // Build answers summing to `total`: worst everywhere, then improve items.
    const answers = allAt(4);
    let remaining = total;
    for (const i of OHS_ITEMS) {
      const give = Math.min(4, remaining);
      answers[i.id] = 4 - give;
      remaining -= give;
    }
    const r = scoreOhs(answers);
    expect(r.total).toBe(total);
    return r.band;
  };

  it("places each boundary on the published cut-points", () => {
    expect(bandAt(19)).toBe("severe");
    expect(bandAt(20)).toBe("moderate-to-severe");
    expect(bandAt(29)).toBe("moderate-to-severe");
    expect(bandAt(30)).toBe("mild-to-moderate");
    expect(bandAt(39)).toBe("mild-to-moderate");
    expect(bandAt(40)).toBe("satisfactory");
  });
});

describe("scoreOhs — incomplete questionnaires", () => {
  /**
   * The important behaviour: a partially completed PROM has no defined total.
   * Pro-rating one produces a number that looks comparable to a real score and
   * is not.
   */
  it("returns no total until every item is answered", () => {
    const partial = { ...allAt(0) };
    delete partial[OHS_ITEMS[3].id];
    const r = scoreOhs(partial);
    expect(r.complete).toBe(false);
    expect(r.total).toBeUndefined();
    expect(r.band).toBeUndefined();
  });

  it("names what is still missing, in order", () => {
    const partial = { ...allAt(2) };
    delete partial[OHS_ITEMS[0].id];
    delete partial[OHS_ITEMS[7].id];
    const r = scoreOhs(partial);
    expect(r.missing).toEqual([OHS_ITEMS[0].id, OHS_ITEMS[7].id]);
    expect(r.answered).toBe(10);
  });

  it("treats an out-of-range or non-integer answer as unanswered rather than clamping", () => {
    for (const bad of [-1, 5, 2.5, NaN]) {
      const r = scoreOhs({ ...allAt(0), [OHS_ITEMS[0].id]: bad });
      expect(r.complete).toBe(false);
      expect(r.missing).toContain(OHS_ITEMS[0].id);
    }
  });

  it("reports nothing answered for an empty submission", () => {
    const r = scoreOhs({});
    expect(r.answered).toBe(0);
    expect(r.missing).toHaveLength(12);
  });
});

describe("placeholder wording is always declared", () => {
  /**
   * Until the licensed text is dropped in, a total is a within-patient trend
   * and not an Oxford Hip Score. Every result must say so, so no surface can
   * present the number as comparable to published norms by omission.
   */
  it("flags placeholder wording on complete and incomplete results alike", () => {
    expect(scoreOhs(allAt(0)).usesPlaceholderWording).toBe(true);
    expect(scoreOhs({}).usesPlaceholderWording).toBe(true);
  });
});

describe("ohsChange", () => {
  it("reports direction and magnitude between two completed scores", () => {
    const before = scoreOhs(allAt(3));
    const after = scoreOhs(allAt(1));
    const c = ohsChange(before, after)!;
    expect(c.delta).toBe(24);
    expect(c.direction).toBe("improved");
  });

  it("reports worsening as a negative delta", () => {
    const c = ohsChange(scoreOhs(allAt(1)), scoreOhs(allAt(3)))!;
    expect(c.delta).toBe(-24);
    expect(c.direction).toBe("worsened");
  });

  it("calls an identical score unchanged", () => {
    expect(ohsChange(scoreOhs(allAt(2)), scoreOhs(allAt(2)))!.direction).toBe("unchanged");
  });

  /** No comparison against an incomplete questionnaire — there is no total to compare. */
  it("refuses to compare when either score is incomplete", () => {
    const partial = scoreOhs({});
    expect(ohsChange(partial, scoreOhs(allAt(0)))).toBeUndefined();
    expect(ohsChange(scoreOhs(allAt(0)), partial)).toBeUndefined();
  });

  /**
   * Deliberately absent: any claim about whether a change is clinically
   * important. The MCID is a published, contested, population-dependent number
   * and asserting one here would be an uncited threshold.
   */
  it("does not assert clinical significance", () => {
    const c = ohsChange(scoreOhs(allAt(3)), scoreOhs(allAt(1)))!;
    expect(c).not.toHaveProperty("clinicallyImportant");
    expect(c).not.toHaveProperty("mcid");
  });
});
