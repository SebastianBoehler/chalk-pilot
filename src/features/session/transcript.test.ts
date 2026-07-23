import { describe, expect, it, vi } from "vitest";
import type { RealtimeItem } from "@openai/agents/realtime";
import { persistTranscript } from "./transcript";

describe("persistTranscript", () => {
  it("reports each newly completed line once for recording attachment", () => {
    const line = {
      type: "message",
      role: "user",
      status: "completed",
      itemId: "item-1",
      content: [{ type: "input_text", text: "Explain this proof." }],
    } as unknown as RealtimeItem;
    const persisted = new Set<string>();
    const onLine = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({})),
    );

    persistTranscript([line], "session-1", persisted, vi.fn(), onLine);
    persistTranscript([line], "session-1", persisted, vi.fn(), onLine);

    expect(onLine).toHaveBeenCalledOnce();
    expect(onLine).toHaveBeenCalledWith({
      sourceId: "item-1",
      role: "user",
      text: "Explain this proof.",
    });
    vi.unstubAllGlobals();
  });
});
