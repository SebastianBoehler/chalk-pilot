import { describe, expect, it, vi } from "vitest";
import { coordinatorFixture as fixture } from "./recording-coordinator-fixture";
import { deferred } from "./recording-test-helpers";

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

  it("interrupts only an ended source and finalizes healthy tracks", async () => {
    const test = fixture();
    await test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });

    test.boardTrack.end();
    await vi.waitFor(() => expect(test.client.interrupt).toHaveBeenCalled());

    expect(test.coordinator.status).toBe("error");
    expect(test.recorders[0]?.stop).toHaveBeenCalledOnce();
    expect(
      test.recorders.slice(1).every(({ stop }) => stop.mock.calls.length === 0),
    ).toBe(true);
    expect(test.displayVideoTrack.stop).not.toHaveBeenCalled();
    expect(test.displayAudioTrack.stop).not.toHaveBeenCalled();
    expect(test.boardTrack.stop).not.toHaveBeenCalled();
    expect(test.client.interrupt).toHaveBeenCalledWith(
      "session-1",
      "board",
      expect.stringContaining("board"),
    );

    const result = await test.coordinator.stop();

    expect(result.state).toBe("interrupted");
    expect(result.tracks.board.health).toBe("interrupted");
    expect(test.client.finalizeRecording).toHaveBeenCalledOnce();
  });

  it("acknowledges pending and final track data before persisting interruption", async () => {
    const test = fixture();
    const pendingUpload = deferred();
    const finalUpload = deferred();
    test.client.uploadChunk
      .mockReturnValueOnce(pendingUpload.promise)
      .mockReturnValueOnce(finalUpload.promise);
    await test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });
    test.setClock(2_100);
    const boardRecorder = test.recorders[0]!;
    boardRecorder.emit("pending-board-data");
    boardRecorder.stop.mockImplementationOnce(() => {
      boardRecorder.state = "inactive";
      boardRecorder.emit("final-board-data");
      boardRecorder.onstop?.();
    });

    test.boardTrack.end();

    expect(test.client.uploadChunk).toHaveBeenCalledTimes(2);
    expect(test.client.interrupt).not.toHaveBeenCalled();
    pendingUpload.resolve();
    await pendingUpload.promise;
    await Promise.resolve();
    expect(test.client.interrupt).not.toHaveBeenCalled();

    finalUpload.resolve();
    await vi.waitFor(() => expect(test.client.interrupt).toHaveBeenCalled());
    expect(
      test.client.uploadChunk.mock.invocationCallOrder.every(
        (order) => order < test.client.interrupt.mock.invocationCallOrder[0]!,
      ),
    ).toBe(true);
  });

  it("interrupts only a recorder that reports an encoding error", async () => {
    const test = fixture();
    await test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });

    test.recorders[1]?.fail("encoder failed");
    await vi.waitFor(() => expect(test.client.interrupt).toHaveBeenCalled());

    expect(test.client.interrupt).toHaveBeenCalledWith(
      "session-1",
      "speaker",
      expect.stringContaining("encoder failed"),
    );
    expect(test.recorders[1]?.stop).not.toHaveBeenCalled();
    expect(test.recorders[0]?.stop).not.toHaveBeenCalled();
    expect(
      test.recorders.slice(2).every(({ stop }) => stop.mock.calls.length === 0),
    ).toBe(true);
  });

  it("waits for final data after an inactive recorder error", async () => {
    const test = fixture();
    const finalUpload = deferred();
    test.client.uploadChunk.mockReturnValueOnce(finalUpload.promise);
    await test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });
    test.setClock(2_100);

    test.recorders[1]?.fail("encoder failed", "final-speaker-data");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(test.client.uploadChunk).toHaveBeenCalledTimes(1);
    expect(test.client.interrupt).not.toHaveBeenCalled();
    finalUpload.resolve();
    await vi.waitFor(() => expect(test.client.interrupt).toHaveBeenCalled());
    expect(test.client.uploadChunk.mock.invocationCallOrder[0]).toBeLessThan(
      test.client.interrupt.mock.invocationCallOrder[0]!,
    );
  });

  it("uses the stop timestamp rather than upload completion for duration", async () => {
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
    test.setClock(12_100);
    upload.resolve();
    await stopped;

    expect(test.client.finalizeRecording).toHaveBeenCalledWith(
      "session-1",
      2_000,
    );
  });

  it("interrupts a synchronous stop failure and always cleans display capture", async () => {
    const test = fixture();
    await test.coordinator.start({
      sessionId: "session-1",
      board: test.board,
      speaker: test.speaker,
      microphone: test.microphone,
    });
    test.recorders[0]?.stop.mockImplementationOnce(() => {
      throw new DOMException("encoder failed");
    });

    const result = await test.coordinator.stop();

    expect(result.state).toBe("interrupted");
    expect(test.client.interrupt).toHaveBeenCalledWith(
      "session-1",
      "board",
      expect.stringContaining("encoder failed"),
    );
    expect(test.displayVideoTrack.stop).toHaveBeenCalledOnce();
    expect(test.displayAudioTrack.stop).toHaveBeenCalledOnce();
    expect(test.coordinator.status).toBe("complete");
  });
});
