import { vi } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { ChalkPilotRealtime, type RealtimeSessionPort } from "./session";

export const emptyCanvas: CanvasState = {
  version: 1,
  focusId: null,
  order: [],
  sections: {},
};

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

interface RealtimeHarnessOptions {
  changed?: boolean;
  now?: () => number;
  onCueStart?: (speaker: "user" | "assistant", atMs: number) => void;
  onCueEnd?: (speaker: "user" | "assistant", atMs: number) => void;
}

export function createRealtimeHarness(
  input: boolean | RealtimeHarnessOptions = true,
) {
  const options = typeof input === "boolean" ? { changed: input } : input;
  const changed = options.changed ?? true;
  const order: string[] = [];
  const listeners = new Map<string, (value?: unknown) => void>();
  const onError = vi.fn();
  const onCanvasChanged = vi.fn();
  const onCanvasJobError = vi.fn();
  const onCanvasJobState = vi.fn();
  const onCueStart = vi.fn((speaker: "user" | "assistant", atMs: number) =>
    options.onCueStart?.(speaker, atMs),
  );
  const onCueEnd = vi.fn((speaker: "user" | "assistant", atMs: number) =>
    options.onCueEnd?.(speaker, atMs),
  );
  const session: RealtimeSessionPort = {
    transport: {
      sendEvent: (event) => order.push(String(event.type)),
    },
    on: (event, listener) => {
      listeners.set(event, listener);
    },
    connect: vi.fn(async () => undefined),
    addImage: vi.fn(() => order.push("image")),
    sendMessage: vi.fn(() => order.push("message")),
    mute: vi.fn(),
    close: vi.fn(),
  };
  const board = {
    hasMaterialChange: vi.fn(() => changed),
    getLatestImage: vi.fn(() => "data:image/jpeg;base64,board"),
    markSent: vi.fn(() => order.push("marked")),
  };
  const fetcher = vi.fn(async (input: string | URL | Request) =>
    String(input).endsWith("/api/realtime-token")
      ? Response.json({ value: "ek_test_secret" })
      : Response.json(emptyCanvas),
  );
  const microphone = {} as MediaStream;
  const createSession = vi.fn(() => session);
  const realtime = new ChalkPilotRealtime({
    sessionId: "session-1",
    board,
    microphone,
    fetcher,
    createSession,
    createJobId: () => "job-1",
    onCanvasChanged,
    onCanvasJobError,
    onCanvasJobState,
    onError,
    onCueStart,
    onCueEnd,
    now: options.now ?? (() => 1_234),
  });
  return {
    board,
    fetcher,
    listeners,
    microphone,
    onCanvasChanged,
    onCanvasJobError,
    onCanvasJobState,
    onError,
    onCueStart,
    onCueEnd,
    order,
    realtime,
    session,
    createSession,
  };
}
