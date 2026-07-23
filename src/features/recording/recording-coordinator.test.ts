import { describe, expect, it, vi } from "vitest";
import { coordinatorFixture as fixture } from "./recording-coordinator-fixture";
import {
  deferred,
  FakeTrack,
  manifest,
  stream,
} from "./recording-test-helpers";

describe("RecordingCoordinator start", () => {
  it("requests protected display audio and starts five two-second recorders", async () => {
    const test = fixture();

    const result = await test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });

    expect(result.sessionId).toBe("session-1");
    expect(test.getDisplayMedia).toHaveBeenCalledWith({
      audio: true,
      selfBrowserSurface: "include",
      systemAudio: "include",
      video: true,
    });
    expect(test.recorders).toHaveLength(5);
    expect(test.recorders.map(({ start }) => start.mock.calls[0])).toEqual([
      [2_000],
      [2_000],
      [2_000],
      [2_000],
      [2_000],
    ]);
    expect(test.coordinator.status).toBe("recording");
    expect(test.coordinator.replayUrl).toBe("/replay/session-1");
  });

  it.each([
    ["board video", "board", "video"],
    ["speaker video", "speaker", "video"],
    ["microphone audio", "microphone", "audio"],
    ["display video", "display", "video"],
    ["desktop audio", "display", "audio"],
  ] as const)(
    "rejects missing live %s before any recorder starts",
    async (_label, source, kind) => {
      const test = fixture();
      const missing = stream(new FakeTrack(kind, false));
      if (source === "display") {
        const retained =
          kind === "video" ? new FakeTrack("audio") : new FakeTrack("video");
        test.getDisplayMedia.mockResolvedValue(
          kind === "video"
            ? stream(new FakeTrack("video", false), retained)
            : stream(retained, new FakeTrack("audio", false)),
        );
      }

      await expect(
        test.coordinator.start({
          sessionId: "session-1",
          board: source === "board" ? missing : test.board,
          speaker: source === "speaker" ? missing : test.speaker,
          microphone: source === "microphone" ? missing : test.microphone,
        }),
      ).rejects.toThrow(/unavailable/);

      expect(test.recorders).toHaveLength(0);
      expect(test.client.createRecording).not.toHaveBeenCalled();
      expect(test.boardTrack.stop).not.toHaveBeenCalled();
      expect(test.speakerTrack.stop).not.toHaveBeenCalled();
      expect(test.microphoneTrack.stop).not.toHaveBeenCalled();
    },
  );

  it("aborts and persists a track ending while recording creation is pending", async () => {
    const test = fixture();
    const creation = deferred<ReturnType<typeof manifest>>();
    test.client.createRecording.mockReturnValueOnce(creation.promise);

    const starting = test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });
    await Promise.resolve();
    test.boardTrack.end();
    creation.resolve(manifest());

    await expect(starting).rejects.toThrow("board");
    expect(test.recorders).toHaveLength(0);
    expect(test.client.interrupt).toHaveBeenCalledWith(
      "session-1",
      "board",
      expect.stringContaining("board"),
    );
  });

  it("does not interrupt a server recording that was never created", async () => {
    const test = fixture();
    const creation = deferred<ReturnType<typeof manifest>>();
    test.client.createRecording.mockReturnValueOnce(creation.promise);

    const starting = test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });
    await Promise.resolve();
    test.boardTrack.end();
    creation.reject(new Error("creation failed"));

    await expect(starting).rejects.toThrow("creation failed");
    expect(test.client.interrupt).not.toHaveBeenCalled();
  });

  it("returns idle when the display picker is cancelled", async () => {
    const test = fixture();
    test.getDisplayMedia.mockRejectedValueOnce(
      new DOMException("cancelled", "NotAllowedError"),
    );

    await expect(
      test.coordinator.start({
        sessionId: "session-1",
        board: test.board,
        speaker: test.speaker,
        microphone: test.microphone,
      }),
    ).rejects.toThrow("cancelled");

    expect(test.coordinator.status).toBe("idle");
    expect(test.coordinator.error).toBeNull();
  });

  it("reports a network AbortError after display selection as an error", async () => {
    const test = fixture();
    test.client.createRecording.mockRejectedValueOnce(
      new DOMException("network aborted", "AbortError"),
    );

    await expect(
      test.coordinator.start({
        sessionId: "session-1",
        board: test.board,
        speaker: test.speaker,
        microphone: test.microphone,
      }),
    ).rejects.toThrow("network aborted");

    expect(test.coordinator.status).toBe("error");
    expect(test.coordinator.error?.message).toBe("network aborted");
  });

  it("cleans every acquired display track when validation fails", async () => {
    const test = fixture();
    const video = new FakeTrack("video");
    const missingAudio = new FakeTrack("audio", false);
    test.getDisplayMedia.mockResolvedValueOnce(stream(video, missingAudio));

    await expect(
      test.coordinator.start({
        sessionId: "session-1",
        board: test.board,
        speaker: test.speaker,
        microphone: test.microphone,
      }),
    ).rejects.toThrow("desktop audio");

    expect(video.stop).toHaveBeenCalledOnce();
    expect(missingAudio.stop).toHaveBeenCalledOnce();
  });
});

describe("RecordingCoordinator chunks", () => {
  it("numbers chunks in event order against one shared monotonic epoch", async () => {
    const test = fixture();
    await test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });

    test.setClock(2_100);
    test.recorders[0]?.emit("board-0");
    test.recorders[1]?.emit("speaker-0");
    test.setClock(4_100);
    test.recorders[0]?.emit("board-1");
    await Promise.resolve();

    expect(
      test.client.uploadChunk.mock.calls.map(([chunk]) => ({
        track: chunk.track,
        sequence: chunk.sequence,
        offsetMs: chunk.offsetMs,
        durationMs: chunk.durationMs,
      })),
    ).toEqual([
      { track: "board", sequence: 0, offsetMs: 0, durationMs: 2_000 },
      { track: "speaker", sequence: 0, offsetMs: 0, durationMs: 2_000 },
      { track: "board", sequence: 1, offsetMs: 2_000, durationMs: 2_000 },
    ]);
  });

  it("retains pending uploads until acknowledgement and bounds the queue", async () => {
    const test = fixture(2);
    const first = deferred();
    const second = deferred();
    test.client.uploadChunk
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });

    test.setClock(2_100);
    const retained = test.recorders[0]?.emit("board-0");
    test.recorders[1]?.emit("speaker-0");
    expect(test.coordinator.pendingUploadCount).toBe(2);
    expect(test.coordinator.pendingUploadJobs).toEqual([
      expect.objectContaining({ data: retained, track: "board" }),
      expect.objectContaining({ track: "speaker" }),
    ]);
    test.recorders[2]?.emit("canvas-0");

    expect(test.coordinator.status).toBe("error");
    expect(test.client.uploadChunk).toHaveBeenCalledTimes(2);
    expect(test.recorders[2]?.stop).toHaveBeenCalledOnce();
    expect(test.recorders[0]?.stop).not.toHaveBeenCalled();
    expect(test.recorders[1]?.stop).not.toHaveBeenCalled();
    first.resolve();
    await first.promise;
    await Promise.resolve();
    expect(test.coordinator.pendingUploadCount).toBe(1);
    expect(
      test.coordinator.pendingUploadJobs.some(({ data }) => data === retained),
    ).toBe(false);
    second.resolve();
  });

  it("interrupts only the track whose upload fails", async () => {
    const test = fixture();
    test.client.uploadChunk.mockRejectedValueOnce(new Error("disk stalled"));
    await test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });

    test.recorders[0]?.emit("board");
    await vi.waitFor(() =>
      expect(test.client.interrupt).toHaveBeenCalledWith(
        "session-1",
        "board",
        expect.stringContaining("disk stalled"),
      ),
    );

    expect(test.recorders[0]?.stop).toHaveBeenCalledOnce();
    expect(
      test.recorders.slice(1).every(({ stop }) => stop.mock.calls.length === 0),
    ).toBe(true);
  });
});
