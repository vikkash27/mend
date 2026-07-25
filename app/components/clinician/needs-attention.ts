type Level = "green" | "amber" | "red";

export function pickNeedsAttention<
  T extends { latest: { decision: { level: Level } } },
>(patients: ReadonlyArray<T>, limit = 5): T[] {
  return patients
    .filter((p) => p.latest.decision.level !== "green")
    .slice(0, Math.max(0, limit));
}
