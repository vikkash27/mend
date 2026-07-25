import { Phone, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MendLogo } from "@/app/components/brand/MendLogo";
import { PhoneFrame, resolvePhoneFramed } from "@/app/components/device/PhoneFrame";
import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";
import { CheckinStrip, type CheckinDay } from "@/app/components/family/CheckinStrip";
import { familyCopy } from "@/app/components/family/copy";
import { SeverityChip } from "@/components/ui/severity-chip";
import { composeDecision } from "@/lib/clinical/compose";
import { evaluate } from "@/lib/clinical/red-flag-engine";
import { getPhase } from "@/lib/clinical/recovery-graph";
import { evaluateTrends } from "@/lib/clinical/trends";
import type { Decision, Symptoms, TrendFinding, VitalsReading } from "@/lib/clinical/types";
import { fetchDemoPatient } from "@/lib/db/queries";
import { getSupabaseClient } from "@/lib/db/supabase";
import { buildFallbackSbar } from "@/lib/llm/sbar";
import { familyRecallSummary } from "@/lib/memory/last-checkin";
import { loadActiveScenario } from "@/lib/sim/active-scenario";
import { scenarioEcg, scenarioHistory, scenarioVitals, type Scenario } from "@/lib/sim/fixtures";
import { resolveFamilyScenario } from "@/lib/sim/resolve-demo";

/**
 * /family — the daughter's view, read on a phone at work.
 *
 * She has one question: "is Mom all right, or do I need to drive over?"
 * Layout matches the landing family preview: chip → headline → story card →
 * actions → week strip, sized to one phone viewport (no scroll).
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mom's recovery — Mend",
  description: "A calm daily update on Margaret's recovery, from Mend's morning call.",
};

const DAY_POST_OP = 4;
const PROCEDURE = "Hip hemiarthroplasty";
const MOM_TEL = "+15550100123";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WELL_SUMMARY =
  "She said the pain keeps easing, she slept through the night, and she's been up and about with her walker.";

interface FamilyState {
  decision: Decision;
  findings: TrendFinding[];
  history: VitalsReading[];
}

async function loadFamilyRecall(): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) return "";
  try {
    const patient = await fetchDemoPatient(supabase);
    if (!patient) return "";
    return familyRecallSummary(patient.id);
  } catch {
    return "";
  }
}

function symptomsFor(scenario: Scenario): Symptoms {
  if (scenario === "pe") {
    return { breathless: true, chestPain: true, painScore: 4, painControlled: true };
  }
  return { painScore: 3, painControlled: true, breathless: false };
}

function loadState(scenario: Scenario): FamilyState {
  const history = scenarioHistory(scenario);
  const findings = evaluateTrends(
    history,
    history.map(() => ({})),
    getPhase(DAY_POST_OP),
  );
  const symptoms = symptomsFor(scenario);
  const base = evaluate({
    dayPostOp: DAY_POST_OP,
    symptoms,
    vitals: scenarioVitals(scenario, new Date()),
    ecg: scenarioEcg(scenario),
  });
  return { decision: composeDecision(base, findings), findings, history };
}

function formatCallTime(date: Date): string {
  return date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s/g, "\u00A0");
}

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function lastSevenDays(history: VitalsReading[], now: Date): CheckinDay[] {
  const checked = new Set(
    history
      .map((r) => new Date(r.timestamp))
      .filter((d) => !Number.isNaN(d.getTime()))
      .map(localDayKey),
  );

  const days: CheckinDay[] = [];
  for (let ago = 6; ago >= 0; ago--) {
    const day = new Date(now.getTime() - ago * MS_PER_DAY);
    days.push({
      key: localDayKey(day),
      letter: day.toLocaleDateString("en-US", { weekday: "narrow" }),
      name: day.toLocaleDateString("en-US", { weekday: "long" }),
      checkedIn: checked.has(localDayKey(day)),
      isToday: ago === 0,
    });
  }
  return days;
}

function forwardHref(state: FamilyState): string {
  const sbar = buildFallbackSbar({
    patient: "Margaret",
    dayPostOp: DAY_POST_OP,
    procedure: PROCEDURE,
    decision: state.decision,
    symptoms: { painScore: 3, painControlled: true, breathless: false },
    vitals: state.history[state.history.length - 1],
    ecg: scenarioEcg("drift"),
    trendFindings: state.findings,
  });
  const subject = "Mend update on Margaret — needs attention today";
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(sbar)}`;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const activeScenario = await loadActiveScenario();
  const scenario = resolveFamilyScenario(first(params.state), activeScenario);
  const framed = resolvePhoneFramed(params.frame);

  const state = loadState(scenario);
  const copy = familyCopy(state.decision, state.findings);
  const recall = await loadFamilyRecall();
  const now = new Date();
  const days = lastSevenDays(state.history, now);
  const urgent = Boolean(copy.whatHappened);
  const story = urgent
    ? [copy.whatHappened, copy.whatMendAsked].filter(Boolean).join(" ")
    : WELL_SUMMARY;

  return (
    <PhoneFrame framed={framed} stage>
      <main className="mx-auto flex h-full w-full max-w-md flex-col px-5 pt-11 pb-4 md:pt-12">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-ink"
            aria-label="Mend home"
          >
            <MendLogo
              variant="lockup"
              size="sm"
              wordmarkClassName="text-xl"
            />
          </Link>
          <p className="font-sans text-[11px] font-medium tracking-[0.12em] text-ink-tertiary uppercase">
            Recovery updates
          </p>
        </div>

        <div className="pt-3">
          <SeverityChip level={state.decision.level} size="md" />
        </div>

        <h1 className="pt-3 font-heading text-[1.65rem] leading-tight text-balance text-ink sm:text-heading">
          {copy.headline}
        </h1>

        <p className="pt-2 text-lg text-ink-secondary">
          Mend called her today at <time>{formatCallTime(now)}</time>.
        </p>

        <div
          className={
            urgent
              ? "mt-4 rounded-2xl border border-severity-red-border bg-severity-red-bg p-3.5"
              : "mt-4 rounded-2xl border border-line bg-raised p-3.5 shadow-[0_8px_24px_-18px_rgba(28,25,23,0.35)]"
          }
        >
          <p className="font-serif text-lg leading-snug text-ink">{story}</p>
          {recall ? (
            <p className="pt-2 text-lg leading-snug text-ink-secondary">{recall}</p>
          ) : null}
        </div>

        {urgent ? (
          <div className="flex flex-col gap-2.5 pt-4">
            <a
              href={`tel:${MOM_TEL}`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink text-lg font-medium text-paper"
            >
              <Phone aria-hidden="true" className="size-4" strokeWidth={2} />
              Call Mom
            </a>
            <a
              href={forwardHref(state)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-raised text-lg font-medium text-ink"
            >
              <Send aria-hidden="true" className="size-4" strokeWidth={2} />
              Forward the care summary
            </a>
          </div>
        ) : (
          <div className="pt-4">
            <a
              href={`tel:${MOM_TEL}`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink text-lg font-medium text-paper"
            >
              <Phone aria-hidden="true" className="size-4" strokeWidth={2} />
              Call Mom
            </a>
          </div>
        )}

        <div className="mt-auto space-y-3 pt-4">
          <CheckinStrip days={days} compact />
          <p className="text-lg text-ink-tertiary">Mend calls her every morning.</p>
          <MedicalAdviceDisclaimer tone="quiet" />
        </div>
      </main>
    </PhoneFrame>
  );
}
