import { describe, expect, it, vi } from "vitest";
import { PoseWorkerClient, type PoseWorkerPort } from "./pose-worker-client";

describe("PoseWorkerClient", () => {
  it("transfers frames with strictly increasing video timestamps", async () => {
    const worker = new FakePoseWorker();
    const client = new PoseWorkerClient(worker);
    const firstFrame = { close: vi.fn() } as unknown as ImageBitmap;
    const first = client.detect(firstFrame, 100);
    worker.respond(0, { boxes: [] });
    await first;
    const second = client.detect(
      { close: vi.fn() } as unknown as ImageBitmap,
      100,
    );
    worker.respond(1, { boxes: [] });
    await second;

    expect(worker.messages[0]?.message).toMatchObject({ timestampMs: 100 });
    expect(
      (worker.messages[1]?.message as { timestampMs: number }).timestampMs,
    ).toBeGreaterThan(100);
    expect(worker.messages[0]?.transfer).toEqual([firstFrame]);
  });

  it("surfaces worker failures and rejects pending work on disposal", async () => {
    const worker = new FakePoseWorker();
    const client = new PoseWorkerClient(worker);
    const failed = client.detect({} as ImageBitmap, 10);
    worker.respond(0, { error: "Pose model failed.", ok: false });
    await expect(failed).rejects.toThrow("Pose model failed.");

    const pending = client.detect({} as ImageBitmap, 20);
    client.dispose();
    await expect(pending).rejects.toThrow("closed");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("is terminal after disposal and closes frames it can no longer transfer", async () => {
    const worker = new FakePoseWorker();
    const client = new PoseWorkerClient(worker);
    client.dispose();
    const frame = { close: vi.fn() } as unknown as ImageBitmap;

    await expect(client.detect(frame, 10)).rejects.toThrow("closed");
    expect(frame.close).toHaveBeenCalledOnce();
    expect(worker.messages).toHaveLength(0);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("becomes terminal after a worker error", async () => {
    const worker = new FakePoseWorker();
    const client = new PoseWorkerClient(worker);
    const pending = client.detect(
      { close: vi.fn() } as unknown as ImageBitmap,
      1,
    );
    worker.onerror?.({} as ErrorEvent);

    await expect(pending).rejects.toThrow("unexpectedly");
    const next = { close: vi.fn() } as unknown as ImageBitmap;
    await expect(client.detect(next, 2)).rejects.toThrow("unexpectedly");
    expect(next.close).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("closes the frame, rejects, and clears pending work when postMessage throws", async () => {
    const worker = new FakePoseWorker();
    const client = new PoseWorkerClient(worker);
    const frame = { close: vi.fn() } as unknown as ImageBitmap;
    worker.postError = new Error("structured clone failed");

    await expect(client.detect(frame, 10)).rejects.toThrow(
      "structured clone failed",
    );
    expect(frame.close).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
    const next = { close: vi.fn() } as unknown as ImageBitmap;
    await expect(client.detect(next, 20)).rejects.toThrow(
      "structured clone failed",
    );
    expect(next.close).toHaveBeenCalledOnce();
    expect(worker.messages).toHaveLength(0);
  });
});

class FakePoseWorker implements PoseWorkerPort {
  readonly messages: { message: unknown; transfer?: Transferable[] }[] = [];
  postError?: Error;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  terminate = vi.fn();

  postMessage(message: unknown, options?: StructuredSerializeOptions): void {
    if (this.postError) throw this.postError;
    this.messages.push({ message, transfer: options?.transfer });
  }

  respond(index: number, payload: Record<string, unknown>) {
    const request = this.messages[index]?.message as { id: string };
    this.onmessage?.({
      data: { id: request.id, ok: payload.ok ?? true, ...payload },
    } as MessageEvent);
  }
}
