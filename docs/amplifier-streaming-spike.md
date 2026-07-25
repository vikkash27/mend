# Amplifier streaming spike (Task 11)

**Decision: DROP for v1.** Spike notes (`docs/amplifier-spike-notes.md`) found no workable mid-call WebSocket path—only REST upload + job poll (optional webhook). Mend v1 stays post-call analyze + poll only; no during-call factor display or streaming probe.
