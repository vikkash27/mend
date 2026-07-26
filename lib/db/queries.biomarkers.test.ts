import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VoiceBiomarkersRecord } from "../amplifier/types";
import type { Database } from "./supabase";
import {
  findCheckinByVoiceConversationId,
  updateCheckinAfterBiomarkers,
} from "./queries";

function mockClientForUpdateEq() {
  const eq = vi.fn().mockResolvedValue({ data: null, error: null });
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
    update,
    eq,
  };
}

const readyRecord: VoiceBiomarkersRecord = {
  status: "ready",
  conversationId: "conv-1",
  jobIds: ["job-a", "job-b"],
  analyzedAt: "2026-07-25T12:00:00.000Z",
  mapped: {
    quality: "ok",
    respiratory: { level: "low" },
    cognitive: { level: "moderate" },
    source: "amplifier",
  },
};

describe("updateCheckinAfterBiomarkers", () => {
  it("updates the checkin row by id and returns true", async () => {
    const { client, from, update, eq } = mockClientForUpdateEq();
    const patch = {
      voice_biomarkers: readyRecord,
      decision: { level: "amber" },
      sbar: "Updated SBAR",
      trend_findings: [],
    };

    const ok = await updateCheckinAfterBiomarkers(client, "checkin-7", patch);

    expect(from).toHaveBeenCalledWith("checkins");
    expect(update).toHaveBeenCalledWith(patch);
    expect(eq).toHaveBeenCalledWith("id", "checkin-7");
    expect(ok).toBe(true);
  });

  it("returns false when the update reports a Supabase error", async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: { message: "update failed" } });
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const client = { from } as unknown as SupabaseClient<Database>;

    await expect(
      updateCheckinAfterBiomarkers(client, "checkin-7", {
        voice_biomarkers: { status: "error", error: "boom" },
      }),
    ).resolves.toBe(false);
  });

  it("returns false when the update times out or throws (withTimeout soft-fail)", async () => {
    const eq = vi.fn().mockRejectedValue(new Error("network down"));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const client = { from } as unknown as SupabaseClient<Database>;

    await expect(
      updateCheckinAfterBiomarkers(client, "checkin-7", {
        voice_biomarkers: { status: "pending", conversationId: "conv-1" },
      }),
    ).resolves.toBe(false);
  });
});

describe("findCheckinByVoiceConversationId", () => {
  it("queries checkins by voice_biomarkers conversationId containment", async () => {
    const row = {
      id: "checkin-9",
      patient_id: "p1",
      created_at: "2026-07-26T10:00:00.000Z",
      day_post_op: 3,
      transcript: "ok",
      symptoms: {},
      vitals: {},
      decision: { level: "green" },
      trend_findings: [],
      sbar: null,
      voice_biomarkers: { status: "pending", conversationId: "conv-xyz" },
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const contains = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ contains }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as unknown as SupabaseClient<Database>;

    const found = await findCheckinByVoiceConversationId(client, "conv-xyz");

    expect(from).toHaveBeenCalledWith("checkins");
    expect(contains).toHaveBeenCalledWith("voice_biomarkers", {
      conversationId: "conv-xyz",
    });
    expect(found).toEqual(row);
  });

  it("returns undefined when no row matches", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const contains = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ contains }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as unknown as SupabaseClient<Database>;

    await expect(
      findCheckinByVoiceConversationId(client, "missing"),
    ).resolves.toBeUndefined();
  });
});
