export const BUSINESS_CASE_HREF = "/business-case" as const;

export const businessCaseCopy = {
  brand: "Mend",
  navLabel: "Business case",
  contactCta: "Talk to us",
  hero: {
    headline: "Why capital backs this — and why patients pick up.",
    support:
      "Outpatient joints moved the operation home. Mend turns the post-discharge gap into capacity, liability cover, and a phone call elderly patients will actually answer.",
    primaryCta: "Open clinician hub",
    primaryHref: "/clinician",
    secondaryCta: "See the product",
    secondaryHref: "/",
  },
  thesis: {
    eyebrow: "The commercial thesis",
    title: "Capacity expansion is the load-bearing case.",
    support:
      "Complication reduction matters clinically. For ASC buyers, the money clears when a defensible home safety net lets medical directors accept patients they currently send to the hospital.",
    points: [
      {
        title: "Safer broader selection",
        body: "Older, higher ASA, or socially isolated joint patients can stay in the ASC when there is an audited voice-and-vitals loop after discharge.",
      },
      {
        title: "Facility margin, not novelty",
        body: "Every recovered case is contribution margin. Mend is sold as operating capacity — not another wellness app for the PT department.",
      },
      {
        title: "Clears without RTM gymnastics",
        body: "Global-period billing makes remote-monitoring add-ons fragile. The core model amortizes on facility volume alone; RTM is upside, not the thesis.",
      },
    ],
  },
  buyers: {
    eyebrow: "Why investors and ASC buyers need this",
    title: "The ward stayed in the hospital. The patient went home.",
    support:
      "Same-day total joints are mature. Post-op observation was cut from days to hours — and the highest-risk window still sits at home, unwatched.",
    drivers: [
      {
        title: "Outpatient migration",
        body: "Total joint replacement is shifting into ASCs at scale. Centers that can prove a home safety net win higher-acuity contracts and keep deferred cases.",
      },
      {
        title: "The black-hole window",
        body: "After the 24-hour nurse call, days two through fourteen often have no active surveillance — exactly when VTE and other complications cluster.",
      },
      {
        title: "OR throughput & surgeon time",
        body: "Administrators care about cases per room and fewer voicemail-tag follow-ups. Mend absorbs routine contact so teams stay in the OR, not on the phone.",
      },
      {
        title: "Auditable vigilance",
        body: "Physician-owners and medical directors need a continuous record of post-op attention when they broaden who they accept for same-day discharge.",
      },
    ],
  },
  economics: {
    eyebrow: "Illustrative economics",
    title: "A few recovered cases carry the subscription.",
    support:
      "For a modeled 400-case orthopaedic ASC, recovering roughly a 3% lift in elective arthroplasty throughput amortizes a mid-tier annual subscription — before counting nurse hours reclaimed.",
    caveat:
      "Figures below are illustrative model defaults from Mend’s ASC worksheet — not forecasts, live deployments, or promises of performance.",
    metricLabel: "Illustrative breakeven",
    metricValue: "~12 cases / year",
    metricNote: "≈ 3% throughput lift on a 400-case center at $2,500 contribution margin",
    rows: [
      { lift: "1%", cases: "4", margin: "$10,000" },
      { lift: "3%", cases: "12", margin: "$30,000", highlight: true },
      { lift: "5%", cases: "20", margin: "$50,000" },
      { lift: "10%", cases: "40", margin: "$100,000" },
    ],
    columns: {
      lift: "Throughput lift",
      cases: "Additional cases",
      margin: "Recovered margin*",
    },
    footnote: "*At an illustrative $2,500 facility contribution margin per case.",
  },
  consumers: {
    eyebrow: "Why consumers will use this",
    title: "They will answer the phone. They will not download another app.",
    support:
      "The highest-risk joint patients are often elderly, fatigued, and living alone. Mend meets them where compliance already exists — a calm daily call — and keeps families in the loop without clinical jargon.",
    points: [
      {
        title: "Voice-first, zero download",
        body: "Mend places the check-in. No patient portal password, no app store step, no “please update your software” friction after a hip replacement.",
      },
      {
        title: "Plain language, not a portal",
        body: "Patients speak how they feel. The model extracts structure; a deterministic engine decides severity. Guidance stays clear: rest, call the care team, or escalate.",
      },
      {
        title: "Families get the same truth",
        body: "Caregivers receive a morning update aligned to the engine — not a rewritten story — so they know whether to drive over without decoding vitals charts.",
      },
      {
        title: "The call prompts the cuff",
        body: "Device adherence fails when it is a separate chore. The daily voice check-in is the prompt to take readings, then the chart and engine see the same numbers.",
      },
    ],
  },
  wedge: {
    eyebrow: "Why this wins the seat",
    title: "Built for ASC workflows, not hospital IT roadmaps.",
    support:
      "Incumbents assume Epic lock-in, PT-app engagement, or implant-tied software. Mend is a phone call plus a deterministic safety net that deploys with the administrator and medical director — not a 12-month CIO program.",
    rows: [
      {
        rival: "App-first rehab",
        friction: "Patient must download and comply",
        mend: "Automated phone call — zero download",
      },
      {
        rival: "SMS surveys",
        friction: "Ignored texts; no vitals fusion",
        mend: "Spoken check-in fused with home vitals",
      },
      {
        rival: "Hospital EHR companions",
        friction: "Assumes enterprise MyChart-style portals",
        mend: "ASC-native: lightweight EHRs, fast go-live",
      },
    ],
  },
  close: {
    title: "See the product behind the memorandum.",
    support:
      "Tour the clinician hub, patient call request, and family update — one morning event, three audiences, same engine decision.",
    primaryCta: "Open clinician hub",
    primaryHref: "/clinician",
    secondaryCta: "Back to Mend",
    secondaryHref: "/",
    figuresNote:
      "Financial figures on this page are illustrative model inputs, not forecasts. Synthetic data only.",
  },
} as const;
