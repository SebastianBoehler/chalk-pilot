import { describe, expect, it } from "vitest";
import {
  RecorderLifecycle,
  stopRecorder,
} from "./recording-recorder-lifecycle";
import { FakeRecorder, stream } from "./recording-test-helpers";

describe("RecorderLifecycle", () => {
  it("settles a wired recorder that was never started", async () => {
    const recorder = new FakeRecorder(stream());
    const lifecycle = new RecorderLifecycle();

    await stopRecorder(recorder, lifecycle);

    expect(lifecycle.state).toBe("unobservable");
    expect(recorder.stop).not.toHaveBeenCalled();
  });
});
