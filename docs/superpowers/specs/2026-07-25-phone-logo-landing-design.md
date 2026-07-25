# Mend — Phone frames, logo, and landing dynamics

**Design spec · 2026-07-25**  
**Audience:** YC demo polish on product surfaces and marketing landing  
**Status:** Approved for implementation

---

## 1. Goal

Make Mend feel like a finished product brand and make the phone seats readable on a laptop projector: device chrome around family/patient, a mark-forward logo, and a landing page that shows the product in motion.

**Success criteria**
- `/family` and `/patient` render inside a phone frame on `md+` viewports; native phone widths stay full-bleed.
- Landing hero and product section show looping product theater (animated HTML + committed silent clips).
- Mark-forward Mend logo in nav, hero, clinician shell, call stage, and favicon.
- `?frame=0` disables phone chrome for harness/capture.
- Reduced motion freezes animations; no invented hospital logos or metrics.

---

## 2. Decisions

| Topic | Choice |
|---|---|
| Phone frames | Live `/family` + `/patient` **and** landing previews |
| Media | Animated HTML demos always on; Playwright silent MP4s in `public/landing/` |
| Logo | Mark-forward abstract **mend stitch**; wordmark secondary in lockup |

---

## 3. Brand

- `MendMark` — SVG stitch mark, `currentColor`, sizes sm/md/lg.
- `MendLogo` — `mark` | `lockup` variants.
- Favicon from the mark (`app/icon.svg`).
- Ink/paper tokens only; no purple glow, no medical cross/heart/ECG cliché.

---

## 4. PhoneFrame

- Restrained bezel (island, thin rim, soft shadow).
- Scrollable content; children unchanged.
- Frame only at `md+`; below that, no chrome.
- Escape hatch: `?frame=0`.
- Not applied to clinician hub or `/call` projector.

---

## 5. Landing dynamics

- **Hero:** looping product theater (call → engine → same truth on family/clinician); video underlay when MP4 present.
- **Surfaces:** “See the seats” — family + patient in phone frames, clinician in laptop frame; quiet deep links remain below.
- **How it works:** staggered beat reveal + subtle progress cue (2–3 motions).
- Capture script writes hero + surface posters/clips from live routes.

---

## 6. Non-goals

- Framing clinician hub or fullscreen `/call`.
- Narrated marketing films, fake logos/metrics, dark mode, clinical engine changes.

---

## 7. Verification

- `npm test` green.
- Manual: `/`, `/family`, `/patient` at laptop and phone widths; `?frame=0`; reduced-motion calm.
