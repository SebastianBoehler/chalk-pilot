import { describe, expect, it } from "vitest";
import { BoardWorkerClient, type WorkerPort } from "./worker-client";

describe("BoardWorkerClient", () => {
  it("matches a worker response to its request", async () => {
    const worker = new RecordingWorker();
    const client = new BoardWorkerClient(worker);
    const image = {
      data: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 1,
      height: 1,
    } as ImageData;

    const pending = client.detect(image);
    const request = worker.messages[0] as { id: string };
    worker.respond({
      id: request.id,
      ok: true,
      result: { corners: null, confidence: 0 },
    });

    await expect(pending).resolves.toEqual({ corners: null, confidence: 0 });
  });

  it("surfaces bounded worker errors", async () => {
    const worker = new RecordingWorker();
    const client = new BoardWorkerClient(worker);
    const image = {
      data: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 1,
      height: 1,
    } as ImageData;

    const pending = client.detect(image);
    const request = worker.messages[0] as { id: string };
    worker.respond({ id: request.id, ok: false, error: "Board not found" });

    await expect(pending).rejects.toThrow("Board not found");
  });
});

class RecordingWorker implements WorkerPort {
  messages: unknown[] = [];
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  terminate(): void {}

  respond(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
