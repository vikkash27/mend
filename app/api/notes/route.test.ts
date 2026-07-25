import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

function getReq(patientId: string) {
  return new Request(
    `http://localhost/api/notes?patientId=${encodeURIComponent(patientId)}`,
  );
}

function postReq(body: unknown) {
  return new Request("http://localhost/api/notes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET/POST /api/notes", () => {
  it("rejects unknown patients and empty bodies", async () => {
    const missing = await GET(getReq("not-a-patient"));
    expect(missing.status).toBe(404);

    const empty = await POST(
      postReq({ patientId: "margaret-ellison", body: "  " }),
    );
    expect(empty.status).toBe(400);
  });

  it("adds and lists notes for a roster patient", async () => {
    const created = await POST(
      postReq({
        patientId: "margaret-ellison",
        body: "Spoke with caregiver; she is en route.",
        author: "RN Demo",
      }),
    );
    expect(created.status).toBe(201);
    const createdJson = (await created.json()) as {
      note: { body: string; author: string };
    };
    expect(createdJson.note.body).toContain("caregiver");
    expect(createdJson.note.author).toBe("RN Demo");

    const listed = await GET(getReq("margaret-ellison"));
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as {
      notes: Array<{ body: string }>;
    };
    expect(listedJson.notes.some((n) => n.body.includes("caregiver"))).toBe(
      true,
    );
  });
});
