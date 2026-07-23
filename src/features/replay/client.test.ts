import { describe, expect, it, vi } from "vitest";
import { ReplayClient } from "./client";

const manifest = {
  schemaVersion: 1,
  sessionId: "session-1",
  state: "complete",
  startedAt: "2026-07-23T10:00:00.000Z",
  finalizedAt: "2026-07-23T10:01:00.000Z",
  durationMs: 60_000,
  tracks: Object.fromEntries(
    ["board", "speaker", "canvas", "microphone", "desktop-audio"].map(
      (kind) => [
        kind,
        {
          kind,
          health: "complete",
          mimeType: kind.includes("audio") ? "audio/webm" : "video/webm",
          durationMs: 60_000,
          byteSize: 10,
          path: `tracks/${kind}.webm`,
          acknowledgedSequences: [0],
          missingSequences: [],
          interruption: null,
        },
      ],
    ),
  ),
  transcriptPath: "transcript.json",
  canvasEventsPath: "canvas-events.json",
};

describe("ReplayClient", () => {
  it("validates recording summaries, manifests, and timeline evidence", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json([
          {
            sessionId: "session-1",
            state: "complete",
            startedAt: manifest.startedAt,
            finalizedAt: manifest.finalizedAt,
            durationMs: 60_000,
            availableTracks: ["board"],
          },
        ]),
      )
      .mockResolvedValueOnce(Response.json(manifest))
      .mockResolvedValueOnce(
        Response.json({
          transcript: [
            {
              type: "transcript",
              speaker: "user",
              startMs: 0,
              endMs: 1_000,
              text: "What is a token?",
            },
          ],
          canvasEvents: [
            {
              type: "canvas",
              offsetMs: 0,
              revision: {
                version: 1,
                focusId: null,
                order: [],
                sections: {},
              },
            },
          ],
        }),
      );
    const client = new ReplayClient(fetcher);

    expect(await client.list()).toHaveLength(1);
    expect(await client.manifest("session-1")).toMatchObject({
      sessionId: "session-1",
    });
    expect(await client.timeline("session-1")).toMatchObject({
      transcript: [{ text: "What is a token?" }],
    });
  });

  it("rejects malformed persisted timeline evidence", async () => {
    const client = new ReplayClient(
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          transcript: [],
          canvasEvents: [
            { type: "canvas", offsetMs: 0, revision: { version: 99 } },
          ],
        }),
      ),
    );

    await expect(client.timeline("session-1")).rejects.toThrow(
      "invalid replay timeline",
    );
  });

  it("surfaces API errors and creates encoded download URLs", async () => {
    const client = new ReplayClient(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json({ error: "Recording not found." }, { status: 404 }),
        ),
    );

    await expect(client.manifest("missing")).rejects.toThrow(
      "Recording not found.",
    );
    expect(client.trackUrl("session-1", "desktop-audio")).toBe(
      "/api/sessions/session-1/recording/tracks/desktop-audio",
    );
    expect(client.exportUrl("session-1")).toBe(
      "/api/sessions/session-1/recording/export",
    );
  });
});
