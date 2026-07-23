import type { BoardCorners, DetectionResult } from "./types";

export interface WorkerPort {
  onerror: ((event: ErrorEvent) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
}

interface WorkerResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

export class BoardWorkerClient {
  private readonly pending = new Map<string, PendingRequest>();

  constructor(private readonly worker: WorkerPort) {
    worker.onmessage = (event) => this.handleResponse(event.data);
    worker.onerror = () =>
      this.rejectAll("Board processing stopped unexpectedly");
  }

  detect(image: ImageData): Promise<DetectionResult> {
    return this.send<DetectionResult>({ type: "detect", image });
  }

  warp(image: ImageData, corners: BoardCorners): Promise<ImageData> {
    return this.send<ImageData>({ type: "warp", image, corners });
  }

  dispose(): void {
    this.rejectAll("Board processing was closed");
    this.worker.terminate();
  }

  private send<T>(payload: Record<string, unknown>): Promise<T> {
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.worker.postMessage({ id, ...payload });
    });
  }

  private handleResponse(raw: unknown) {
    const response = raw as WorkerResponse;
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    if (response.ok) pending.resolve(response.result);
    else pending.reject(new Error(response.error ?? "Board processing failed"));
  }

  private rejectAll(message: string) {
    for (const request of this.pending.values())
      request.reject(new Error(message));
    this.pending.clear();
  }
}

export function createBoardWorkerClient(): BoardWorkerClient {
  return new BoardWorkerClient(
    new Worker(new URL("./opencv.worker.ts", import.meta.url), {
      type: "module",
    }),
  );
}
