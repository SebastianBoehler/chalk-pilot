import type { PersonBox } from "./presenter-tracker";

export interface PoseWorkerPort {
  onerror: ((event: ErrorEvent) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown, options?: StructuredSerializeOptions): void;
  terminate(): void;
}

interface WorkerResponse {
  id: string;
  ok: boolean;
  boxes?: PersonBox[];
  error?: string;
}

interface PendingDetection {
  resolve: (boxes: PersonBox[]) => void;
  reject: (error: Error) => void;
}

export class PoseWorkerClient {
  private readonly pending = new Map<string, PendingDetection>();
  private previousTimestamp = -1;
  private terminalError: Error | undefined;

  constructor(private readonly worker: PoseWorkerPort) {
    worker.onmessage = (event) => this.handleResponse(event.data);
    worker.onerror = () =>
      this.close(new Error("Presenter tracking stopped unexpectedly."));
  }

  detect(frame: ImageBitmap, timestampMs: number): Promise<PersonBox[]> {
    if (this.terminalError) {
      frame.close();
      return Promise.reject(this.terminalError);
    }
    const id = crypto.randomUUID();
    const monotonicTimestamp = Math.max(
      timestampMs,
      this.previousTimestamp + 0.001,
    );
    this.previousTimestamp = monotonicTimestamp;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.worker.postMessage(
          { frame, id, timestampMs: monotonicTimestamp, type: "detect" },
          { transfer: [frame] },
        );
      } catch (cause) {
        frame.close();
        this.close(
          cause instanceof Error
            ? cause
            : new Error("The presenter frame could not be sent."),
        );
      }
    });
  }

  dispose(): void {
    this.close(new Error("Presenter tracking was closed."));
  }

  private handleResponse(raw: unknown) {
    const response = raw as WorkerResponse;
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    if (response.ok) pending.resolve(response.boxes ?? []);
    else {
      pending.reject(
        new Error(response.error ?? "Presenter detection failed."),
      );
    }
  }

  private close(error: Error) {
    if (this.terminalError) return;
    this.terminalError = error;
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.terminate();
  }
}

export function createPoseWorkerClient() {
  return new PoseWorkerClient(
    new Worker(new URL("./pose.worker.ts", import.meta.url), {
      type: "module",
    }),
  );
}
