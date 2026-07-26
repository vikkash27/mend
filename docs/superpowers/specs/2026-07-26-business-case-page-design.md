# Mend Business Case Page — Investor & Consumer Showcase

**Design spec · 2026-07-26**  
**Route:** `/business-case` (`app/business-case/page.tsx`)  
**Nav:** “Business case” tab on marketing surfaces (landing + this page)  
**Audience:** Investors / ASC buyers *and* visitors asking whether patients will actually use it  
**Sources:** ASC Business Case & Investment Memorandum decks (narrative only; public-safe framing)

---

## 1. Goal

Give a calm, editorial page that answers two questions without dumping a confidential memo:

1. **Why investors / ASC buyers need this** — outpatient joint migration created a post-discharge safety gap; Mend’s commercial value is capacity expansion (safer broader patient selection), not a complication-reduction pitch alone.
2. **Why consumers will use this** — elderly post-op patients answer a phone; they do not download another app. Families get a clear update; clinicians get the same engine truth.

**Success criteria**
- Separate route with first-class nav entry from `/`.
- Matches landing paper / IBM Plex / motion system; light-only.
- One job per section; no dashboard clutter, no fake customer logos.
- Financial figures are clearly **illustrative model defaults**, not forecasts or named-customer claims.
- MedicalAdviceDisclaimer present; no hero badges/overlays.
- WCAG AA; `prefers-reduced-motion` respected.

---

## 2. Information architecture

| Order | Section | Job |
|---|---|---|
| 0 | Top bar | Mend lockup → `/`, Business case (active), Talk to us |
| 1 | Hero | Brand-forward + one headline + one support + CTA group |
| 2 | Thesis | Capacity expansion is the commercial load-bearing term |
| 3 | Why buyers need it | Outpatient shift, black-hole window, OR throughput / liability |
| 4 | Illustrative economics | Killer metric (breakeven on ~3% throughput) + caveat |
| 5 | Why patients use it | Voice-first, no app, family clarity, call prompts vitals |
| 6 | Competitive wedge | Phone vs app / SMS / hospital-EHR lock-in |
| 7 | Close | Product CTAs + disclaimer + illustrative-figures note |

**Out of scope:** Interactive ROI calculator from the deck, confidential EV/ARR tables, fake pilots, CapEx procurement forms.

---

## 3. Visual & motion

- Reuse `app/globals.css` tokens and `useLandingMotion`.
- Hero: brand lockup at display weight, wash gradients (same as landing), no inset media collage.
- Economics: typographic table / metric strip — not a SaaS pricing card wall.
- Motion (min 3): hero stagger, section `whileInView` reveals, interactive hover on wedge / adoption rows.

---

## 4. Copy honesty

- No named hospitals/customers; no “trusted by” claims.
- Industry figures may cite CMS / general market framing as context, presented as industry overview not Mend performance.
- Unit economics: label as illustrative defaults for a typical orthopaedic ASC model.
- Keep US clinical register (no NHS terms).

---

## 5. File layout

```
app/business-case/page.tsx
app/components/business-case/
  copy.ts
  copy.test.ts
  BusinessCasePage.tsx
  sections.tsx          # hero → close section components
app/components/landing/LandingNav.tsx   # add Business case tab
app/components/landing/copy.ts          # navBusinessCase label + href
```
