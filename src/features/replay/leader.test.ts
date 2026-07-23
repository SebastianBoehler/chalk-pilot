import { describe, expect, it } from "vitest";
import type { RecordingManifest, TrackKind } from "@/features/recording/schema";
import { selectReplayLeader } from "./leader";

function manifest(
  tracks: Partial<
    Record<
      TrackKind,
      Pick<
        RecordingManifest["tracks"][TrackKind],
        "byteSize" | "durationMs" | "health"
      >
    >
  >,
): RecordingManifest {
  const kinds: TrackKind[] = [
    "board",
    "speaker",
    "canvas",
    "microphone",
    "desktop-audio",
  ];
  return {
    schemaVersion: 1,
    sessionId: "session-1",
    state: "interrupted",
    startedAt: "2026-07-23T10:00:00.000Z",
    finalizedAt: "2026-07-23T10:02:00.000Z",
    durationMs: 120_000,
    tracks: Object.fromEntries(
      kinds.map((kind) => {
        const value = tracks[kind] ?? {
          byteSize: 0,
          durationMs: 0,
          health: "interrupted" as const,
        };
        return [
          kind,
          {
            kind,
            ...value,
            mimeType: value.byteSize ? "video/webm" : null,
            path: `tracks/${kind}.webm`,
            acknowledgedSequences: value.byteSize ? [0] : [],
            missingSequences: [],
            interruption: null,
          },
        ];
      }),
    ) as unknown as RecordingManifest["tracks"],
    transcriptPath: "transcript.json",
    canvasEventsPath: "canvas-events.json",
  };
}

describe("selectReplayLeader", () => {
  it("prefers the longest finalized complete track over an interrupted primary", () => {
    const recording = manifest({
      canvas: { byteSize: 10, durationMs: 120_000, health: "interrupted" },
      board: { byteSize: 10, durationMs: 110_000, health: "complete" },
      microphone: { byteSize: 10, durationMs: 119_000, health: "complete" },
    });

    expect(selectReplayLeader(recording)).toBe("microphone");
  });

  it("uses the longest interrupted track only when no complete track exists", () => {
    const recording = manifest({
      canvas: { byteSize: 10, durationMs: 40_000, health: "interrupted" },
      board: { byteSize: 10, durationMs: 90_000, health: "interrupted" },
    });

    expect(selectReplayLeader(recording)).toBe("board");
  });

  it("rejects unfinalized and zero-duration tracks", () => {
    const recording = manifest({
      microphone: { byteSize: 10, durationMs: 0, health: "healthy" },
    });
    expect(selectReplayLeader(recording)).toBeUndefined();

    recording.finalizedAt = null;
    recording.tracks.microphone.durationMs = 120_000;
    expect(selectReplayLeader(recording)).toBeUndefined();

    recording.finalizedAt = "2026-07-23T10:02:00.000Z";
    recording.durationMs = 0;
    expect(selectReplayLeader(recording)).toBeUndefined();
  });
});
