import { describe, expect, it, vi } from "vitest";
import type { RealtimeItem } from "@openai/agents/realtime";
import { extractTranscript, persistTranscript } from "./transcript";

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

  it("shows function calls without persisting them as spoken turns", () => {
    const toolCall = {
      type: "function_call",
      status: "completed",
      itemId: "tool-1",
      name: "focus_canvas",
      arguments: '{"targetId":"mechanism"}',
      output: '{"focused":true}',
    } as unknown as RealtimeItem;
    const update = vi.fn();
    const onLine = vi.fn();
    const fetcher = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetcher);

    persistTranscript(
      [toolCall],
      "session-1",
      new Set<string>(),
      update,
      onLine,
    );

    expect(update).toHaveBeenCalledWith([
      {
        sourceId: "tool-1",
        role: "tool",
        toolName: "focus_canvas",
        status: "completed",
        text: "Target: mechanism · Focused: yes",
      },
    ]);
    expect(onLine).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("extractTranscript", () => {
  it("maps running and incomplete tool calls to readable statuses", () => {
    const running = {
      type: "function_call",
      status: "in_progress",
      itemId: "tool-running",
      name: "delegate_canvas_task",
      arguments: '{"goal":"Build a causal flow","artifact":"flow"}',
      output: null,
    } as unknown as RealtimeItem;
    const failed = {
      type: "function_call",
      status: "incomplete",
      itemId: "tool-failed",
      name: "inspect_board",
      arguments: "{}",
      output: '{"error":"No confirmed board image is available."}',
    } as unknown as RealtimeItem;

    expect(extractTranscript([running, failed])).toEqual([
      {
        sourceId: "tool-running",
        role: "tool",
        toolName: "delegate_canvas_task",
        status: "running",
        text: "Goal: Build a causal flow · Artifact: flow",
      },
      {
        sourceId: "tool-failed",
        role: "tool",
        toolName: "inspect_board",
        status: "failed",
        text: "Error: No confirmed board image is available.",
      },
    ]);
  });
});
