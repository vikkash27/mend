import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  extractSymptoms,
  parseSymptomsMessage,
  REPORT_SYMPTOMS_TOOL,
} from "./extract";
import { fixtureMessage, fixtureTextBlock, fixtureToolUseBlock } from "./test-fixtures";
import type { Symptoms } from "../clinical/types";

describe("REPORT_SYMPTOMS_TOOL schema", () => {
  it("forces the exact tool name used by tool_choice", () => {
    expect(REPORT_SYMPTOMS_TOOL.name).toBe("report_symptoms");
  });

  it("mirrors every field of Symptoms, with painScore as a 0-10 integer", () => {
    const props = REPORT_SYMPTOMS_TOOL.input_schema.properties as Record<
      string,
      { type: string; minimum?: number; maximum?: number }
    >;
    const expectedBooleanKeys: Array<keyof Symptoms> = [
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
    for (const key of expectedBooleanKeys) {
      expect(props[key].type).toBe("boolean");
    }
    expect(props.painScore.type).toBe("integer");
    expect(props.painScore.minimum).toBe(0);
    expect(props.painScore.maximum).toBe(10);
  });

  it("instructs Claude not to infer, advise, or judge severity", () => {
    const description = REPORT_SYMPTOMS_TOOL.description ?? "";
    expect(description).toMatch(/never infer/i);
    expect(description).toMatch(/not give medical advice/i);
    expect(description).toMatch(/not.*severity/i);
  });

  it("rejects unlisted properties", () => {
    expect(REPORT_SYMPTOMS_TOOL.input_schema.additionalProperties).toBe(false);
  });
});

describe("parseSymptomsMessage", () => {
  it("marks extraction failed when Claude replies with no tool_use block", () => {
    const message = fixtureMessage([fixtureTextBlock("I didn't call the tool.")]);
    expect(parseSymptomsMessage(message)).toEqual({ ok: false, symptoms: {} });
  });

  it("extracts only the fields Claude explicitly set, ignoring unset ones", () => {
    const message = fixtureMessage([
      fixtureToolUseBlock("report_symptoms", {
        breathless: true,
        calfPainOrSwelling: false,
        painScore: 6,
      }),
    ]);

    expect(parseSymptomsMessage(message)).toEqual({
      ok: true,
      symptoms: {
        breathless: true,
        calfPainOrSwelling: false,
        painScore: 6,
      },
    });
  });

  it("treats a successful empty tool_use as ok (genuine no-symptoms report)", () => {
    const message = fixtureMessage([fixtureToolUseBlock("report_symptoms", {})]);
    expect(parseSymptomsMessage(message)).toEqual({ ok: true, symptoms: {} });
  });

  it("ignores a tool_use block for a different (unexpected) tool name", () => {
    const message = fixtureMessage([fixtureToolUseBlock("some_other_tool", { breathless: true })]);
    expect(parseSymptomsMessage(message)).toEqual({ ok: false, symptoms: {} });
  });

  it("drops non-boolean junk on boolean fields rather than trusting it", () => {
    const message = fixtureMessage([
      fixtureToolUseBlock("report_symptoms", { breathless: "yes", chestPain: true }),
    ]);
    expect(parseSymptomsMessage(message)).toEqual({
      ok: true,
      symptoms: { chestPain: true },
    });
  });

  it("clamps an out-of-range painScore into 0-10 and rounds non-integers", () => {
    const tooHigh = fixtureMessage([fixtureToolUseBlock("report_symptoms", { painScore: 14.7 })]);
    const tooLow = fixtureMessage([fixtureToolUseBlock("report_symptoms", { painScore: -3 })]);

    expect(parseSymptomsMessage(tooHigh)).toEqual({ ok: true, symptoms: { painScore: 10 } });
    expect(parseSymptomsMessage(tooLow)).toEqual({ ok: true, symptoms: { painScore: 0 } });
  });

  it("marks extraction failed when tool input is not an object", () => {
    const message = fixtureMessage([fixtureToolUseBlock("report_symptoms", "not an object")]);
    expect(parseSymptomsMessage(message)).toEqual({ ok: false, symptoms: {} });
  });
});

describe("extractSymptoms", () => {
  it("returns ok:false when no client is available (not a successful empty extract)", async () => {
    const result = await extractSymptoms("Patient reports feeling breathless.", { client: null });
    expect(result).toEqual({ ok: false, symptoms: {} });
  });

  it("returns ok:false when the Anthropic call throws", async () => {
    const fakeClient = {
      messages: {
        create: async () => {
          throw new Error("network down");
        },
      },
    } as unknown as Anthropic;

    const result = await extractSymptoms("I can't breathe.", { client: fakeClient });
    expect(result).toEqual({ ok: false, symptoms: {} });
  });

  it("uses tool-forced output and returns the parsed Symptoms from an injected fake client", async () => {
    let capturedParams: Anthropic.MessageCreateParamsNonStreaming | undefined;

    const fakeClient = {
      messages: {
        create: async (params: Anthropic.MessageCreateParamsNonStreaming) => {
          capturedParams = params;
          return fixtureMessage([
            fixtureToolUseBlock("report_symptoms", { chestPain: true, painScore: 8 }),
          ]);
        },
      },
    } as unknown as Anthropic;

    const result = await extractSymptoms("I have chest pain, pain is about an 8.", {
      client: fakeClient,
    });

    expect(result).toEqual({ ok: true, symptoms: { chestPain: true, painScore: 8 } });
    expect(capturedParams?.tool_choice).toEqual({ type: "tool", name: "report_symptoms" });
    expect(capturedParams?.tools?.[0]?.name).toBe("report_symptoms");
  });
});
