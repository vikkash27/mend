import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient, getAnthropicModel } from "./client";
import type { Symptoms } from "../clinical/types";

const REPORT_SYMPTOMS_TOOL_NAME = "report_symptoms";

/**
 * Tool-forced schema mirroring `Symptoms` (lib/clinical/types.ts) verbatim.
 * This is the ONLY output Claude may produce for this call — `tool_choice`
 * below forces it, so there is no prose path to sanitize.
 *
 * The description is the whole safety contract for this module: Claude
 * transcribes what was said, nothing more. It never infers a symptom that
 * wasn't stated, never gives advice, and never judges severity — that
 * remains the exclusive job of `evaluate()` in red-flag-engine.ts.
 */
export const REPORT_SYMPTOMS_TOOL: Anthropic.Tool = {
  name: REPORT_SYMPTOMS_TOOL_NAME,
  description:
    "Record the patient-reported symptoms from this post-operative check-in " +
    "transcript. Set a field ONLY if the patient (or someone speaking for them) " +
    "clearly and explicitly stated it — never infer, guess, or extrapolate from " +
    "tone, silence, or unrelated remarks. Leave a field unset if it was not " +
    "discussed or was ambiguous. Do not give medical advice. Do not assess, " +
    "describe, or hint at how severe or concerning any finding is — severity is " +
    "decided elsewhere, not by you.",
  input_schema: {
    type: "object",
    properties: {
      breathless: {
        type: "boolean",
        description: "Patient explicitly reported feeling breathless or short of breath.",
      },
      chestPain: {
        type: "boolean",
        description: "Patient explicitly reported chest pain.",
      },
      calfPainOrSwelling: {
        type: "boolean",
        description: "Patient explicitly reported calf pain or swelling.",
      },
      woundDischarge: {
        type: "boolean",
        description: "Patient explicitly reported discharge from the surgical wound.",
      },
      feverSubjective: {
        type: "boolean",
        description: "Patient explicitly reported feeling feverish or hot, without necessarily giving a number.",
      },
      suddenSevereHipPain: {
        type: "boolean",
        description: "Patient explicitly reported sudden, severe hip pain.",
      },
      legShortenedOrRotated: {
        type: "boolean",
        description: "Patient explicitly reported their operated leg appearing shortened or rotated.",
      },
      unableToWeightBear: {
        type: "boolean",
        description: "Patient explicitly reported being unable to bear weight on the operated leg.",
      },
      painControlled: {
        type: "boolean",
        description:
          "Patient explicitly stated whether their pain is controlled by the current plan: true if they said it is controlled, false if they said it is not.",
      },
      newConfusion: {
        type: "boolean",
        description: "Patient (or someone speaking for them) explicitly reported new confusion since surgery.",
      },
      painScore: {
        type: "integer",
        minimum: 0,
        maximum: 10,
        description: "The patient's self-reported pain score on a 0-10 scale, only if they stated a number.",
      },
    },
    required: [],
    additionalProperties: false,
  },
};

export interface ExtractSymptomsDeps {
  /** Injected for tests; omit to use the real client from client.ts. */
  client?: Anthropic | null;
  model?: string;
}

/**
 * Result of symptom extraction. Callers MUST distinguish the two cases:
 *
 * - `ok: true` — extraction ran and produced a parseable tool_use. An empty
 *   `symptoms` object means the patient genuinely reported nothing actionable.
 * - `ok: false` — extraction did not run or failed. `symptoms` is empty but
 *   that emptiness is NOT clinically meaningful. Pass
 *   `symptomsUnusable: true` into `evaluate()` so the engine can fail safe
 *   (amber) rather than green.
 *
 * This module never decides severity — that remains `evaluate()`'s job.
 */
export interface ExtractSymptomsResult {
  ok: boolean;
  symptoms: Symptoms;
}

/**
 * Extracts ONLY the structured symptoms a patient stated in `transcript`.
 * Never decides severity, never gives advice — that is `evaluate()`'s job.
 *
 * On missing client, missing tool_use, unparseable tool input, or transport
 * error: returns `{ ok: false, symptoms: {} }`. That is deliberately NOT the
 * same as a successful empty extract — callers must escalate via the engine
 * (`symptomsUnusable`) rather than treating absent fields as reassurance.
 */
export async function extractSymptoms(
  transcript: string,
  deps: ExtractSymptomsDeps = {},
): Promise<ExtractSymptomsResult> {
  const client = deps.client !== undefined ? deps.client : createAnthropicClient();
  if (!client) {
    console.warn(
      "[llm] extractSymptoms: no Anthropic client available — extraction failed (not an empty symptom report).",
    );
    return { ok: false, symptoms: {} };
  }

  const model = deps.model ?? getAnthropicModel();

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 1024,
      system:
        "You transcribe patient-reported symptoms from post-operative check-in calls into " +
        "structured data. You never assess severity, give advice, or decide on escalation.",
      tools: [REPORT_SYMPTOMS_TOOL],
      tool_choice: { type: "tool", name: REPORT_SYMPTOMS_TOOL_NAME },
      messages: [
        { role: "user", content: `Patient check-in transcript:\n\n${transcript}` },
      ],
    });

    return parseSymptomsMessage(message);
  } catch (err) {
    console.warn("[llm] extractSymptoms: Anthropic call failed — extraction failed.", err);
    return { ok: false, symptoms: {} };
  }
}

/** Pure, network-free: pulls the tool_use block out of a Message and
 * sanitizes its input into a `Symptoms` object. Exported for testing
 * against recorded fixture messages. */
export function parseSymptomsMessage(message: Anthropic.Message): ExtractSymptomsResult {
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === REPORT_SYMPTOMS_TOOL_NAME,
  );

  if (!toolUse) {
    return { ok: false, symptoms: {} };
  }

  if (typeof toolUse.input !== "object" || toolUse.input === null) {
    return { ok: false, symptoms: {} };
  }

  return { ok: true, symptoms: sanitizeSymptomsInput(toolUse.input) };
}

const BOOLEAN_SYMPTOM_KEYS: ReadonlyArray<
  Exclude<keyof Symptoms, "painScore">
> = [
  "breathless",
  "chestPain",
  "calfPainOrSwelling",
  "woundDischarge",
  "feverSubjective",
  "suddenSevereHipPain",
  "legShortenedOrRotated",
  "unableToWeightBear",
  "painControlled",
  "newConfusion",
];

/** Defensively re-validates tool input against the `Symptoms` shape even
 * though the schema already constrains it — untrusted external input is
 * `unknown`, and this is the one place that turns it into `Symptoms`. */
function sanitizeSymptomsInput(input: object): Symptoms {
  const raw = input as Record<string, unknown>;
  const symptoms: Symptoms = {};

  for (const key of BOOLEAN_SYMPTOM_KEYS) {
    const value = raw[key];
    if (typeof value === "boolean") {
      symptoms[key] = value;
    }
  }

  const painScore = raw.painScore;
  if (typeof painScore === "number" && Number.isFinite(painScore)) {
    symptoms.painScore = Math.min(10, Math.max(0, Math.round(painScore)));
  }

  return symptoms;
}
