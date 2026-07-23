import { describe, expect, it, vi } from "vitest";
import type { OpenAIRealtimeWebRTC } from "@openai/agents/realtime";
import { createOpenAiSession } from "./openai-session";

describe("createOpenAiSession", () => {
  it("closes the cloned microphone transport when session construction throws", () => {
    const failure = new Error("RealtimeSession construction failed");
    const transport = {
      close: vi.fn(),
    } as unknown as OpenAIRealtimeWebRTC;

    expect(() =>
      createOpenAiSession([], {} as MediaStream, {
        createSession: () => {
          throw failure;
        },
        createTransport: () => transport,
      }),
    ).toThrow(failure);

    expect(transport.close).toHaveBeenCalledOnce();
  });
});
