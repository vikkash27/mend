# Business Case Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a polished `/business-case` marketing route with a landing-nav tab that showcases why investors/ASC buyers need Mend and why patients will use it.

**Architecture:** Mirror the existing landing package: copy module + page shell + section components using Framer Motion helpers from `app/components/landing/motion.ts`. Keep confidential forecast tables out; present illustrative economics with explicit caveats.

**Tech Stack:** Next.js App Router, React 19, Framer Motion, existing Mend design tokens, Vitest for copy honesty.

## Global Constraints

- Light-only paper system; IBM Plex Serif/Sans; no purple SaaS chrome.
- No invented customers, ARR claims as fact, or fake pilots.
- Financial figures labeled illustrative.
- MedicalAdviceDisclaimer on page close.
- Branch naming: `cursor/<name>-4734`.

---

## File map

| File | Responsibility |
|---|---|
| `app/components/business-case/copy.ts` | All page copy + nav labels for this surface |
| `app/components/business-case/copy.test.ts` | Honesty / structure tests |
| `app/components/business-case/sections.tsx` | Section UI |
| `app/components/business-case/BusinessCasePage.tsx` | Page composition + smooth scroll scope |
| `app/business-case/page.tsx` | Route + metadata |
| `app/components/landing/LandingNav.tsx` | Add Business case tab |
| `app/components/landing/copy.ts` | `navBusinessCase` + href |

---

### Task 1: Copy + honesty tests

- [x] Add `copy.ts` with hero, thesis, buyer, economics, consumer, wedge, close.
- [x] Add tests: required sections, no named customers, illustrative caveat present, route `/business-case`.
- [x] Run `npx vitest run app/components/business-case/copy.test.ts`.

### Task 2: Page UI + route

- [x] Implement sections + BusinessCasePage.
- [x] Add `app/business-case/page.tsx` metadata.
- [x] Wire LandingNav with Business case link; update landing copy + landing tests if needed.

### Task 3: Verify + ship

- [x] `npm test` (or targeted) + `npm run lint` + `npm run build`.
- [x] Commit, push, open PR.
