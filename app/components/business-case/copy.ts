export const businessCaseCopy = {
  brand: "Mend",
  eyebrow: "ASC business case",
  headline: "The center sends her home in four hours. Then nobody is watching.",
  support:
    "Why Mend’s buyer is the ambulatory surgery center — and what one year of monitoring is worth.",
  lede:
    "Total joints moved to the ambulatory setting faster than the post-operative safety net did. A hospital discharge has a ward behind it. An ASC discharge has a phone number. That asymmetry is the commercial argument.",
  values: {
    eyebrow: "Three value lines",
    title: "Lead with capacity. Everything else is secondary.",
    support:
      "Cost-savings arguments go to a committee. Capacity arguments go to surgeon-owners — the people whose income rises when the schedule fills.",
    lines: [
      {
        rank: "Dominant",
        title: "Case capacity",
        body: "Centers decline otherwise-suitable patients over age, comorbidity, or living alone. A monitored safety net lets the medical director widen criteria. Every recovered case carries full facility contribution margin.",
      },
      {
        rank: "Reliable",
        title: "Nursing labour",
        body: "Post-op follow-up is already staffed. Mend covers the risk window instead of one call at twenty-four hours, and returns most of those nurse hours to the schedule.",
      },
      {
        rank: "Modest",
        title: "Avoided rescues",
        body: "An unplanned hospital visit after an ambulatory joint is a quality event, an uncompensated rescue, and a referral-pattern problem. Real money — less than capacity.",
      },
    ],
  },
  model: {
    eyebrow: "The model",
    title: "What it is worth to one center",
    support:
      "Every figure is an input, not a claim. Replace the defaults with the center’s own numbers before this means anything.",
    hint: "Edit any field · recalculates live",
  },
  assumptions: {
    eyebrow: "Assumptions",
    title: "Where the model is fragile",
    summary: "Capacity carries the case. Labour and rescues alone do not cover price.",
    fragile:
      "Set declined patients to zero and the default case turns negative — roughly a fourteen thousand dollar annual shortfall at ninety-five dollars per case. Validate the capacity assumption with three medical directors before building anything else, and be prepared to price below ninety-five dollars for a center that will not widen criteria.",
    excludedTitle: "Deliberately excluded",
    excluded:
      "Remote monitoring reimbursement (RPM/RTM) is not in the model. Hip and knee arthroplasty carry a 90-day global surgical period; whether remote monitoring can be billed separately inside that window needs a coding opinion. The model clears on operating value alone.",
    diligence: [
      {
        severity: "High" as const,
        title: "Global-period billing",
        body: "Get a coding opinion before putting reimbursement on any slide.",
      },
      {
        severity: "High" as const,
        title: "Clinical threshold provenance",
        body: "Each escalation threshold needs a named source and medical-director sign-off before non-synthetic deployment.",
      },
      {
        severity: "Medium" as const,
        title: "Device adherence",
        body: "The voice call is the intended countermeasure to the cuff-in-the-drawer failure mode — still a hypothesis until measured.",
      },
    ],
  },
  close: {
    title: "Validate the capacity claim. Then see the product.",
    support:
      "Talk through numbers with us, or open the clinician hub and watch the morning event.",
    primaryCta: "Talk to us",
    secondaryCta: "Open clinician hub",
    secondaryHref: "/clinician",
  },
  landingBand: {
    eyebrow: "For ambulatory surgery centers",
    title: "The ASC is the buyer. Here is the math.",
    support:
      "Hospitals already have a ward. ASCs have a phone number. See the per-center ROI model — live inputs, no invented pilots.",
    cta: "Open the ASC business case",
    href: "/business-case",
  },
  footer:
    "Educational prototype. Synthetic data only, no medical advice. Financial figures are user-supplied inputs and illustrative defaults, not forecasts.",
} as const;
