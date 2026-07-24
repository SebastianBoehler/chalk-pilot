import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { ChalkPilotRealtime } from "./session";
import {
  createRealtimeHarness as createHarness,
  deferred,
  emptyCanvas,
} from "./session-test-harness";

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
      microphone: createHarness().microphone,
      createSession: () => session,
      getCanvas: () => emptyCanvas,
      onCanvasChanged: vi.fn(),
      onNavigation: vi.fn(),
    });

    await expect(withoutInjectedFetch.connect()).resolves.toBeUndefined();
  });

  it("connects with a short-lived browser secret", async () => {
    const { realtime, session } = createHarness();

    await realtime.connect();

    expect(session.connect).toHaveBeenCalledWith({
      apiKey: "ek_test_secret",
      model: "gpt-realtime-mini",
    });
  });

  it("gives the session factory the exact confirmed microphone stream", async () => {
    const { createSession, microphone, realtime } = createHarness();

    await realtime.connect();

    expect(createSession).toHaveBeenCalledWith(expect.any(Array), microphone);
  });

  it("does not create a session when closed before the token resolves", async () => {
    const { createSession, fetcher, realtime } = createHarness();
    const token = deferred<Response>();
    fetcher.mockReturnValue(token.promise);

    const connecting = realtime.connect();
    realtime.close();
    token.resolve(Response.json({ value: "ek_test_secret" }));

    await expect(connecting).rejects.toThrow(
      "The voice session was closed before connecting.",
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  it("closes a session whose connection resolves after close", async () => {
    const { realtime, session } = createHarness();
    const connection = deferred<void>();
    vi.mocked(session.connect).mockReturnValue(connection.promise);

    const connecting = realtime.connect();
    await vi.waitFor(() => expect(session.connect).toHaveBeenCalledOnce());
    realtime.close();
    connection.resolve();

    await expect(connecting).rejects.toThrow(
      "The voice session was closed before connecting.",
    );
    expect(session.close).toHaveBeenCalledOnce();
  });

  it("shares one in-flight connection across duplicate connect calls", async () => {
    const { createSession, realtime, session } = createHarness();
    const connection = deferred<void>();
    vi.mocked(session.connect).mockReturnValue(connection.promise);

    const first = realtime.connect();
    const second = realtime.connect();
    await vi.waitFor(() => expect(session.connect).toHaveBeenCalledOnce());
    connection.resolve();
    await Promise.all([first, second]);

    expect(createSession).toHaveBeenCalledOnce();
  });

  it("closes a failed active session and preserves its connection error", async () => {
    const { realtime, session } = createHarness();
    const failure = new Error("Realtime handshake failed");
    vi.mocked(session.connect).mockRejectedValue(failure);

    await expect(realtime.connect()).rejects.toBe(failure);

    expect(session.close).toHaveBeenCalledOnce();
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

  it("reports user speech and assistant audio bounds on the recording clock", async () => {
    const { listeners, onCueEnd, onCueStart, realtime } = createHarness();
    await realtime.connect();

    listeners.get("transport_event")?.({
      type: "input_audio_buffer.speech_started",
    });
    listeners.get("transport_event")?.({
      type: "input_audio_buffer.speech_stopped",
    });
    listeners.get("audio_start")?.();
    listeners.get("audio_stopped")?.();

    expect(onCueStart).toHaveBeenNthCalledWith(1, "user", 1_234);
    expect(onCueEnd).toHaveBeenNthCalledWith(1, "user", 1_234);
    expect(onCueStart).toHaveBeenNthCalledWith(2, "assistant", 1_234);
    expect(onCueEnd).toHaveBeenNthCalledWith(2, "assistant", 1_234);
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
      expect.stringContaining("Delegate one concise canvas task"),
    );
  });

  it("runs canvas work in the background and privately reports completion", async () => {
    const {
      fetcher,
      onCanvasChanged,
      onCanvasJobState,
      onNavigation,
      order,
      realtime,
    } = createHarness();
    let releaseJob: (response: Response) => void = () => {};
    const jobResponse = new Promise<Response>((resolve) => {
      releaseJob = resolve;
    });
    fetcher.mockImplementation(async (input: string | URL | Request) => {
      if (String(input).endsWith("/api/realtime-token")) {
        return Response.json({ value: "ek_test_secret" });
      }
      return jobResponse;
    });
    await realtime.connect();

    const accepted = realtime.delegateCanvasTask({
      goal: "Add a visual explanation of the attention flow.",
      artifact: "diagram",
    });

    expect(accepted).toEqual({ jobId: "job-1" });
    expect(onCanvasJobState).toHaveBeenCalledWith("building");
    expect(onCanvasChanged).not.toHaveBeenCalled();

    const completedCanvas: CanvasState = {
      ...emptyCanvas,
      focusId: "attention-flow",
      order: ["attention-flow"],
      sections: {
        "attention-flow": {
          id: "attention-flow",
          kind: "mermaid",
          title: "Attention flow",
          content: "flowchart LR\nTokens --> Context",
          createdAt: "2026-07-23T08:00:00.000Z",
          updatedAt: "2026-07-23T08:00:00.000Z",
        },
      },
    };
    releaseJob(
      Response.json({
        jobId: "job-1",
        summary: "Added the attention flow.",
        canvas: completedCanvas,
      }),
    );
    await realtime.whenCanvasJobsIdle();

    expect(onCanvasChanged).toHaveBeenCalledWith(completedCanvas);
    expect(onNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "focus",
        targetId: "attention-flow",
      }),
      completedCanvas,
    );
    expect(onCanvasJobState).toHaveBeenLastCalledWith("complete");
    expect(order).toContain("conversation.item.create");
    expect(order).not.toContain("response.create");
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
