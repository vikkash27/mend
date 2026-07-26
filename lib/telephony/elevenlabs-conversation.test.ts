import { describe, expect, it, vi } from "vitest";
import { fetchConversationDetails } from "./elevenlabs-conversation";

describe("fetchConversationDetails", () => {
  it("returns unavailable when API key missing", async () => {
    const result = await fetchConversationDetails({
      conversationId: "conv_1",
      apiKey: "",
      fetchImpl: vi.fn(),
    });
    expect(result.status).toBe("unavailable");
  });

  it("maps transcript roles and detects ended status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          conversation_id: "conv_1",
          status: "done",
          transcript: [
            { role: "agent", message: "Hello", time_in_call_secs: 1 },
            { role: "user", message: "Hi", time_in_call_secs: 3 },
            { role: "agent", message: null },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await fetchConversationDetails({
      conversationId: "conv_1",
      apiKey: "key",
      fetchImpl,
    });
    expect(result).toMatchObject({
      status: "ok",
      ended: true,
      turns: [
        { role: "agent", text: "Hello" },
        { role: "user", text: "Hi" },
      ],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.elevenlabs.io/v1/convai/conversations/conv_1",
      expect.objectContaining({
        headers: expect.objectContaining({ "xi-api-key": "key" }),
      }),
    );
  });
});
