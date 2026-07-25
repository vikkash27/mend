export const landingCopy = {
  brand: "Mend",
  headline: "Recovery doesn’t end at discharge.",
  support:
    "Voice check-ins at home. A deterministic clinical engine. The right person notified when something drifts.",
  primaryCta: "Open clinician hub",
  primaryHref: "/clinician",
  secondaryCta: "Patient portal",
  secondaryHref: "/patient",
  contactCta: "Talk to us",
  gap: {
    eyebrow: "The gap",
    title: "After discharge, everyone loses the plot.",
    support:
      "Hospitals lose visibility. Families are left with a phone tree. Complications surface late.",
    systemsTitle: "Health systems",
    systemsBody:
      "Post-op patients go home and the care team’s line of sight drops. Drift shows up as a readmission, not a Tuesday morning call.",
    familiesTitle: "Patients and families",
    familiesBody:
      "An elderly patient will answer a calm daily call. They will not open another app. Families need a clear update without clinical jargon.",
  },
  how: {
    eyebrow: "How Mend works",
    title: "One morning event. Three audiences.",
    support:
      "Language models extract and speak. A deterministic engine decides. Escalation is never improvised.",
    beats: [
      {
        title: "Morning voice check-in",
        body: "Mend calls the patient, listens in plain language, and confirms what matters before anything else happens.",
      },
      {
        title: "Deterministic clinical engine",
        body: "Symptoms and vitals meet cited red-flag rules against the recovery phase. The LLM never chooses green, amber, or red.",
      },
      {
        title: "The right people, same truth",
        body: "Patient call guidance, family update, and clinician worklist all reflect the same engine decision.",
      },
    ],
  },
  devices: {
    eyebrow: "Device integrations",
    title: "Give clinicians the signals they need without another app.",
    support:
      "A Kardia PDF lands on the chart when uploaded. A patient’s watch streams heart rate through their phone to the clinician hub in realtime — same numbers, same engine, no re-typing.",
    kardia: {
      title: "KardiaMobile 6L",
      benefit: "PDF upload writes rhythm and BPM onto the patient chart immediately.",
      body: "Drop the Kardia export into Ops. Mend pulls the FDA-cleared determination and BPM onto Margaret’s dashboard and into the red-flag engine — no separate PDF viewer, no waiting for someone to re-type numbers.",
      note: "AliveCor KardiaMobile 6L · PDF export · determination as printed",
    },
    watch: {
      title: "Patient watch → clinician chart",
      benefit: "Margaret’s live HR on her phone is the same BPM the doctor sees — updating together.",
      body: "Her Garmin (or any standard Bluetooth HR watch) broadcasts during an activity. Mend’s patient surface mirrors that BPM, and the clinician hub chart stays in sync in realtime so drift shows up while the check-in is still open.",
      note: "Web Bluetooth · Heart Rate Service · fail-safe if contact is lost",
    },
  },
  trust: {
    eyebrow: "Why trust it",
    title: "Clinical rigor you can inspect.",
    support: "Credibility from architecture — not logo walls or invented pilots.",
    points: [
      {
        title: "Rules you can open",
        body: "Every threshold includes provenance. The vignette suite at /clinician/engine shows what fires and why.",
      },
      {
        title: "Fail-safe by design",
        body: "On ambiguity, missing data, or poor signal quality, Mend escalates. It never reassures into uncertainty.",
      },
      {
        title: "Devices stay devices",
        body: "Mend consumes FDA-cleared determinations from home ECG hardware. It does not re-derive rhythm from a waveform.",
      },
    ],
  },
  surfaces: {
    eyebrow: "See the seats",
    title: "One morning event. Three audiences.",
    support:
      "The clinician hub is the working surface. Family and patient phones reflect the same decision in plain language.",
  },
  close: {
    title: "Built for the hardest week after surgery.",
    support:
      "A voice-first recovery co-pilot for orthopedics — calm when it’s fine, decisive when it isn’t.",
  },
} as const;

/** Optional quiet deep links — not the primary conversion path. */
export const PRODUCT_SURFACES = [
  {
    href: "/clinician",
    label: "Clinician hub",
    note: "Daily worklist and live call",
    quiet: true,
  },
  {
    href: "/patient",
    label: "Patient portal",
    note: "Request a check-in call",
    quiet: true,
  },
  {
    href: "/family",
    label: "Family",
    note: "Caregiver morning update",
    quiet: true,
  },
  {
    href: "/clinician/engine",
    label: "Rule engine",
    note: "Deterministic safety rules",
    quiet: true,
  },
] as const;
