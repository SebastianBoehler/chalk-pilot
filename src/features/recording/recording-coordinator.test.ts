import { describe, expect, it, vi } from "vitest";
import { RecordingCoordinator } from "./recording-coordinator";
import {
  deferred,
  FakeRecorder,
  FakeRecordingClient,
  FakeTrack,
  stream,
} from "./recording-test-helpers";

function fixture(maxPendingUploads = 10) {
  const boardTrack = new FakeTrack("video");
  const speakerTrack = new FakeTrack("video");
  const microphoneTrack = new FakeTrack("audio");
  const displayVideoTrack = new FakeTrack("video");
  const displayAudioTrack = new FakeTrack("audio");
  const board = stream(boardTrack);
  const speaker = stream(speakerTrack);
  const microphone = stream(microphoneTrack);
  const display = stream(displayVideoTrack, displayAudioTrack);
  const recorders: FakeRecorder[] = [];
  const client = new FakeRecordingClient();
  let clock = 100;
  const getDisplayMedia = vi.fn(async () => display);
  const coordinator = new RecordingCoordinator({
    client,
    createMediaStream: (tracks) =>
      stream(...(tracks as unknown as FakeTrack[])),
    createRecorder: (source) => {
      const recorder = new FakeRecorder(source);
      recorders.push(recorder);
      return recorder;
    },
    getDisplayMedia,
    maxPendingUploads,
    now: () => clock,
  });
  return {
    board,
    boardTrack,
    client,
    coordinator,
    display,
    displayAudioTrack,
    displayVideoTrack,
    getDisplayMedia,
    microphone,
    microphoneTrack,
    recorders,
    setClock: (value: number) => {
      clock = value;
    },
    speaker,
    speakerTrack,
  };
}

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
    test.recorders[0]?.emit("board-0");
    test.recorders[1]?.emit("speaker-0");
    expect(test.coordinator.pendingUploadCount).toBe(2);
    test.recorders[2]?.emit("canvas-0");

    expect(test.coordinator.status).toBe("error");
    expect(test.client.uploadChunk).toHaveBeenCalledTimes(2);
    first.resolve();
    await first.promise;
    await Promise.resolve();
    expect(test.coordinator.pendingUploadCount).toBe(1);
    second.resolve();
  });
});

describe("RecordingCoordinator stop and interruption", () => {
  it("waits for acknowledged uploads before finalizing and cleans only display tracks", async () => {
    const test = fixture();
    const upload = deferred();
    test.client.uploadChunk.mockReturnValueOnce(upload.promise);
    await test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });
    test.setClock(2_100);
    test.recorders[0]?.emit("board");

    const stopped = test.coordinator.stop();
    await Promise.resolve();
    expect(test.client.finalizeRecording).not.toHaveBeenCalled();
    upload.resolve();
    const result = await stopped;

    expect(result.state).toBe("complete");
    expect(test.client.finalizeRecording).toHaveBeenCalledWith(
      "session-1",
      2_000,
    );
    expect(test.displayVideoTrack.stop).toHaveBeenCalledOnce();
    expect(test.displayAudioTrack.stop).toHaveBeenCalledOnce();
    expect(test.boardTrack.stop).not.toHaveBeenCalled();
    expect(test.speakerTrack.stop).not.toHaveBeenCalled();
    expect(test.microphoneTrack.stop).not.toHaveBeenCalled();
    expect(test.coordinator.status).toBe("complete");
  });

  it("enters error and stops capture when a live source track ends", async () => {
    const test = fixture();
    await test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });

    test.boardTrack.end();
    await Promise.resolve();

    expect(test.coordinator.status).toBe("error");
    expect(
      test.recorders.every(({ stop }) => stop.mock.calls.length === 1),
    ).toBe(true);
    expect(test.displayVideoTrack.stop).toHaveBeenCalledOnce();
    expect(test.displayAudioTrack.stop).toHaveBeenCalledOnce();
    expect(test.boardTrack.stop).not.toHaveBeenCalled();
    expect(test.client.finalizeRecording).not.toHaveBeenCalled();
  });

  it("cleans display capture when a recorder fails during stop", async () => {
    const test = fixture();
    await test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });
    test.recorders[0]?.stop.mockImplementationOnce(() => {
      test.recorders[0]!.state = "inactive";
      test.recorders[0]!.onerror?.({
        error: new DOMException("encoder failed"),
      });
    });

    await expect(test.coordinator.stop()).rejects.toThrow("encoder failed");

    expect(test.displayVideoTrack.stop).toHaveBeenCalledOnce();
    expect(test.displayAudioTrack.stop).toHaveBeenCalledOnce();
    expect(test.coordinator.status).toBe("error");
  });
});
