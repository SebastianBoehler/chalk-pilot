import { describe, expect, it, vi } from "vitest";
import { RecordingTimeline } from "@/features/recording/recording-timeline";
import type { RecordingTimelineEvent } from "@/features/recording/schema";
import { createRealtimeHarness } from "./session-test-harness";

describe("ChalkPilotRealtime cue timing", () => {
  it("ends interrupted assistant audio once and preserves later cue order", async () => {
    const events = vi.fn<(event: RecordingTimelineEvent) => Promise<void>>(
      async () => undefined,
    );
    const timeline = new RecordingTimeline(events);
    timeline.start(1_000);
    let clock = 1_100;
    const { listeners, onCueEnd, realtime } = createRealtimeHarness({
      now: () => clock,
      onCueStart: (speaker, atMs) => timeline.noteCueStart(speaker, atMs),
      onCueEnd: (speaker, atMs) => timeline.noteCueEnd(speaker, atMs),
    });
    await realtime.connect();

    listeners.get("audio_start")?.();
    clock = 1_500;
    listeners.get("audio_interrupted")?.();
    clock = 1_600;
    listeners.get("audio_stopped")?.();
    timeline.attachTranscript({
      sourceId: "assistant-interrupted",
      role: "assistant",
      text: "The interrupted explanation.",
    });

    clock = 2_000;
    listeners.get("audio_start")?.();
    clock = 2_300;
    listeners.get("audio_stopped")?.();
    timeline.attachTranscript({
      sourceId: "assistant-next",
      role: "assistant",
      text: "The later explanation.",
    });
    await timeline.drain();

    expect(onCueEnd).toHaveBeenCalledTimes(2);
    expect(events.mock.calls.map(([event]) => event)).toEqual([
      {
        type: "transcript",
        speaker: "assistant",
        startMs: 100,
        endMs: 500,
        text: "The interrupted explanation.",
      },
      {
        type: "transcript",
        speaker: "assistant",
        startMs: 1_000,
        endMs: 1_300,
        text: "The later explanation.",
      },
    ]);
  });
});
