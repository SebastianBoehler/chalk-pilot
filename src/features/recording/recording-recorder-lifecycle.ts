import type { MediaRecorderPort } from "./recording-media";

export type RecorderLifecycleState =
  "ready" | "started" | "stopped" | "unobservable";

export class RecorderLifecycle {
  readonly stopEvent: Promise<void>;
  state: RecorderLifecycleState = "ready";
  private resolveStop!: () => void;

  constructor() {
    this.stopEvent = new Promise((resolve) => {
      this.resolveStop = resolve;
    });
  }

  markStarted() {
    if (this.state === "ready") this.state = "started";
  }

  observeStop() {
    this.state = "stopped";
    this.resolveStop();
  }

  markStopUnobservable() {
    if (this.state === "stopped") return;
    this.state = "unobservable";
    this.resolveStop();
  }
}

export function startRecorder(
  recorder: MediaRecorderPort,
  lifecycle: RecorderLifecycle,
  timeslice: number,
) {
  recorder.start(timeslice);
  lifecycle.markStarted();
}

export async function stopRecorder(
  recorder: MediaRecorderPort,
  lifecycle: RecorderLifecycle,
) {
  if (lifecycle.state === "ready") {
    lifecycle.markStopUnobservable();
    return;
  }
  if (lifecycle.state === "started" && recorder.state !== "inactive") {
    try {
      recorder.stop();
    } catch (cause) {
      lifecycle.markStopUnobservable();
      throw cause;
    }
  }
  await lifecycle.stopEvent;
}
