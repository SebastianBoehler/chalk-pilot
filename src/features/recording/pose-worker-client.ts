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

  constructor(private readonly worker: PoseWorkerPort) {
    worker.onmessage = (event) => this.handleResponse(event.data);
    worker.onerror = () =>
      this.rejectAll("Presenter tracking stopped unexpectedly.");
  }

  detect(frame: ImageBitmap, timestampMs: number): Promise<PersonBox[]> {
    const id = crypto.randomUUID();
    const monotonicTimestamp = Math.max(
      timestampMs,
      this.previousTimestamp + 0.001,
    );
    this.previousTimestamp = monotonicTimestamp;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(
        { frame, id, timestampMs: monotonicTimestamp, type: "detect" },
        { transfer: [frame] },
      );
    });
  }

  dispose(): void {
    this.rejectAll("Presenter tracking was closed.");
    this.worker.terminate();
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

  private rejectAll(message: string) {
    for (const pending of this.pending.values()) {
      pending.reject(new Error(message));
    }
    this.pending.clear();
  }
}

export function createPoseWorkerClient() {
  return new PoseWorkerClient(
    new Worker(new URL("./pose.worker.ts", import.meta.url), {
      type: "module",
    }),
  );
}
