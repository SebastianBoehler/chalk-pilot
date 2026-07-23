import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { ChalkPilotRealtime, type RealtimeSessionPort } from "./session";

const emptyCanvas: CanvasState = {
  version: 1,
  focusId: null,
  order: [],
  sections: {},
};

function createHarness(changed = true) {
  const order: string[] = [];
  const listeners = new Map<string, (value?: unknown) => void>();
  const onError = vi.fn();
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
  const realtime = new ChalkPilotRealtime({
    sessionId: "session-1",
    board,
    fetcher,
    createSession: () => session,
    onCanvasChanged: vi.fn(),
    onError,
  });
  return { board, listeners, onError, order, realtime, session };
}

describe("ChalkPilotRealtime", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls the browser fetch function with its required global receiver", async () => {
    const { session } = createHarness();
    const strictFetch = vi.fn(function (
      this: unknown,
      input: string | URL | Request,
    ) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return String(input).endsWith("/api/realtime-token")
        ? Promise.resolve(Response.json({ value: "ek_test_secret" }))
        : Promise.resolve(Response.json(emptyCanvas));
    });
    vi.stubGlobal("fetch", strictFetch);
    const withoutInjectedFetch = new ChalkPilotRealtime({
      sessionId: "session-1",
      board: createHarness().board,
      createSession: () => session,
      onCanvasChanged: vi.fn(),
    });

    await expect(withoutInjectedFetch.connect()).resolves.toBeUndefined();
  });

  it("connects with a short-lived browser secret", async () => {
    const { realtime, session } = createHarness();

    await realtime.connect();

    expect(session.connect).toHaveBeenCalledWith({
      apiKey: "ek_test_secret",
      model: "gpt-realtime-2.1",
    });
  });

  it("adds a changed board image before requesting the spoken-turn response", async () => {
    const { listeners, order, realtime } = createHarness();
    await realtime.connect();

    listeners.get("transport_event")?.({
      type: "input_audio_buffer.speech_stopped",
    });
    await realtime.whenIdle();

    expect(order).toEqual(["image", "marked", "response.create"]);
  });

  it("does not resend an unchanged board at the next turn", async () => {
    const { listeners, order, realtime } = createHarness(false);
    await realtime.connect();

    listeners.get("transport_event")?.({
      type: "input_audio_buffer.speech_stopped",
    });
    await realtime.whenIdle();

    expect(order).toEqual(["response.create"]);
  });

  it("waits for the active response to finish before starting the next turn", async () => {
    const { listeners, order, realtime } = createHarness(false);
    await realtime.connect();

    listeners.get("transport_event")?.({
      type: "input_audio_buffer.speech_stopped",
    });
    await realtime.whenIdle();
    listeners.get("transport_event")?.({
      type: "input_audio_buffer.speech_stopped",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(order).toEqual(["response.create"]);

    listeners.get("transport_event")?.({ type: "response.done" });
    await realtime.whenIdle();

    expect(order).toEqual(["response.create", "response.create"]);
  });

  it("supports an explicit board inspection", async () => {
    const { order, realtime, session } = createHarness(false);
    await realtime.connect();

    await realtime.inspectBoardNow();

    expect(order).toEqual(["image", "marked", "message"]);
    expect(session.sendMessage).toHaveBeenCalledWith(
      expect.stringContaining("canvas section"),
    );
  });

  it("surfaces the provider message from a nested SDK error event", async () => {
    const { listeners, onError, realtime } = createHarness();
    await realtime.connect();

    listeners.get("error")?.({
      type: "error",
      error: {
        type: "error",
        error: { message: "A response is already in progress." },
      },
    });

    expect(onError).toHaveBeenCalledWith("A response is already in progress.");
  });
});
