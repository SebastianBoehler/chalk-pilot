import { describe, expect, it, vi } from "vitest";
import type { CanvasNavigation } from "@/features/canvas-navigation/schema";
import type { CanvasState } from "@/features/workspace/schema";
import type { RecordingTimelineEvent } from "./schema";
import { RecordingTimeline } from "./recording-timeline";

const canvas: CanvasState = {
  version: 1,
  focusId: null,
  order: [],
  sections: {},
};

const navigation: CanvasNavigation = {
  requestId: "navigation-1",
  targetId: "gradient",
  kind: "focus",
  issuedAt: "2026-07-24T10:00:00.000Z",
};

describe("RecordingTimeline", () => {
  it("attaches delayed transcript text to its completed speech bounds", async () => {
    const append = vi.fn<(event: RecordingTimelineEvent) => Promise<void>>(
      async () => undefined,
    );
    const timeline = new RecordingTimeline(append);
    timeline.start(1_000);

    timeline.noteCueStart("user", 1_100);
    timeline.noteCueEnd("user", 1_900);
    timeline.attachTranscript({
      sourceId: "user-1",
      role: "user",
      text: "Explain the gradient.",
    });
    await timeline.drain();

    expect(append).toHaveBeenCalledWith({
      type: "transcript",
      speaker: "user",
      startMs: 100,
      endMs: 900,
      text: "Explain the gradient.",
    });
  });

  it("retains text that completes before the matching cue ends", async () => {
    const append = vi.fn(async () => undefined);
    const timeline = new RecordingTimeline(append);
    timeline.start(1_000);

    timeline.noteCueStart("assistant", 1_200);
    timeline.attachTranscript({
      sourceId: "assistant-1",
      role: "assistant",
      text: "Look at the local slope.",
    });
    timeline.noteCueEnd("assistant", 1_700);
    await timeline.drain();

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        speaker: "assistant",
        startMs: 200,
        endMs: 700,
      }),
    );
  });

  it("persists only changed canvas revisions at recording-relative offsets", async () => {
    const append = vi.fn(async () => undefined);
    const timeline = new RecordingTimeline(append);
    timeline.start(2_000);

    timeline.noteCanvas(canvas, 2_000);
    timeline.noteCanvas(canvas, 2_200);
    const changed = { ...canvas, focusId: "gradient" };
    timeline.noteCanvas(changed, 2_700);
    await timeline.drain();

    expect(append).toHaveBeenCalledTimes(2);
    expect(append).toHaveBeenNthCalledWith(1, {
      type: "canvas",
      offsetMs: 0,
      revision: canvas,
    });
    expect(append).toHaveBeenNthCalledWith(2, {
      type: "canvas",
      offsetMs: 700,
      revision: changed,
    });
  });

  it("persists each semantic navigation request at its recording-relative offset", async () => {
    const append = vi.fn(async () => undefined);
    const timeline = new RecordingTimeline(append);
    timeline.start(1_000);

    timeline.noteNavigation(navigation, 1_600);
    timeline.noteNavigation(
      { ...navigation, requestId: "navigation-2" },
      1_700,
    );
    await timeline.drain();

    expect(append).toHaveBeenNthCalledWith(1, {
      type: "navigation",
      offsetMs: 600,
      navigation,
    });
    expect(append).toHaveBeenNthCalledWith(2, {
      type: "navigation",
      offsetMs: 700,
      navigation: { ...navigation, requestId: "navigation-2" },
    });
  });

  it("closes an active cue at stop and drains late text before finalization", async () => {
    const append = vi.fn(async () => undefined);
    const timeline = new RecordingTimeline(append);
    timeline.start(500);
    timeline.noteCueStart("user", 600);
    timeline.closeOpenCues(1_000);
    timeline.attachTranscript({
      sourceId: "user-late",
      role: "user",
      text: "This arrived after speech stopped.",
    });

    await timeline.drain();

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ startMs: 100, endMs: 500 }),
    );
  });

  it("does not attach speech that began before recording to the next cue", async () => {
    const append = vi.fn(async () => undefined);
    const timeline = new RecordingTimeline(append);
    timeline.start(1_000);
    timeline.attachTranscript({
      sourceId: "before-recording",
      role: "user",
      text: "This cue began before the recording.",
    });

    timeline.noteCueStart("user", 2_000);
    timeline.noteCueEnd("user", 2_500);
    timeline.attachTranscript({
      sourceId: "during-recording",
      role: "user",
      text: "This cue belongs to the recording.",
    });
    await timeline.drain();

    expect(append).toHaveBeenCalledOnce();
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ text: "This cue belongs to the recording." }),
    );
  });

  it("seals the queue before durable finalization", async () => {
    const append = vi.fn(async () => undefined);
    const timeline = new RecordingTimeline(append);
    timeline.start(1_000);
    timeline.noteCanvas(canvas, 1_000);
    timeline.seal();

    timeline.noteCanvas({ ...canvas, focusId: "too-late" }, 2_000);
    await timeline.drain();

    expect(append).toHaveBeenCalledOnce();
  });

  it("rejects canvas revisions after the stop boundary", async () => {
    const append = vi.fn<(event: RecordingTimelineEvent) => Promise<void>>(
      async () => undefined,
    );
    const timeline = new RecordingTimeline(append);
    timeline.start(1_000);
    timeline.noteCanvas(canvas, 1_200);
    timeline.noteCueStart("user", 1_300);
    timeline.closeOpenCues(1_500);
    timeline.noteCanvas({ ...canvas, focusId: "after-stop" }, 1_900);
    timeline.attachTranscript({
      sourceId: "late-text",
      role: "user",
      text: "Text for the cue that was open at stop.",
    });
    await timeline.drain();

    const persisted = append.mock.calls.map(([event]) => event);
    expect(persisted).toHaveLength(2);
    expect(persisted).not.toContainEqual(
      expect.objectContaining({
        type: "canvas",
        revision: expect.objectContaining({ focusId: "after-stop" }),
      }),
    );
    expect(
      persisted.flatMap((event) =>
        event.type === "transcript" ? [event.endMs] : [event.offsetMs],
      ),
    ).toEqual([200, 500]);
  });
});
