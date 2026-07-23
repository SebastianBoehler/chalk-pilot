import { describe, expect, it, vi } from "vitest";
import { RecordingClient } from "./recording-client";
import { manifest } from "./recording-test-helpers";

describe("RecordingClient", () => {
  it("exposes the future dynamic replay route", () => {
    expect(new RecordingClient().replayUrl("session one")).toBe(
      "/replay/session%20one",
    );
  });

  it("uses the recording routes and sends exact chunk metadata", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(manifest(), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        Response.json(manifest("session-1", "complete", 2_000)),
      );
    const client = new RecordingClient(fetcher);

    await client.createRecording("session-1");
    await client.uploadChunk({
      sessionId: "session-1",
      track: "desktop-audio",
      sequence: 3,
      offsetMs: 4_000,
      durationMs: 2_000,
      mimeType: "audio/webm;codecs=opus",
      data: new Blob(["audio"]),
    });
    await client.finalizeRecording("session-1", 6_000);

    expect(fetcher.mock.calls[0]?.slice(0, 2)).toEqual([
      "/api/sessions/session-1/recording",
      { method: "POST" },
    ]);
    const [chunkUrl, chunkInit] = fetcher.mock.calls[1] ?? [];
    expect(chunkUrl).toBe(
      "/api/sessions/session-1/recording/tracks/desktop-audio/chunks/3",
    );
    expect(chunkInit).toMatchObject({
      method: "PUT",
      headers: {
        "content-type": "audio/webm;codecs=opus",
        "x-chalkpilot-duration-ms": "2000",
        "x-chalkpilot-offset-ms": "4000",
      },
    });
    expect(fetcher.mock.calls[2]?.slice(0, 2)).toEqual([
      "/api/sessions/session-1/recording/finalize",
      {
        method: "POST",
        body: JSON.stringify({ durationMs: 6_000 }),
        headers: { "content-type": "application/json" },
      },
    ]);
  });

  it("rejects unsuccessful and invalid manifest responses", async () => {
    const failed = new RecordingClient(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ error: "Session not found." }, { status: 404 }),
        ),
    );
    const invalid = new RecordingClient(
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({})),
    );

    await expect(failed.createRecording("missing")).rejects.toThrow(
      "Session not found.",
    );
    await expect(invalid.createRecording("session-1")).rejects.toThrow(
      "invalid recording manifest",
    );
  });
});
