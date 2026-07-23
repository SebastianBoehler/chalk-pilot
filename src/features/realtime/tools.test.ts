import { describe, expect, it, vi } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { createChalkPilotActions } from "./tools";

const emptyCanvas: CanvasState = {
  version: 1,
  focusId: null,
  order: [],
  sections: {},
};

describe("ChalkPilot agent actions", () => {
  it("persists canvas changes before broadcasting them", async () => {
    const order: string[] = [];
    const fetcher = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void input;
        void init;
        order.push("persist");
        return Response.json(emptyCanvas);
      },
    );
    const actions = createChalkPilotActions({
      sessionId: "session-1",
      fetcher,
      inspectBoard: vi.fn(),
      getEvidenceId: () => "turn-1",
      onCanvasChanged: () => order.push("broadcast"),
    });

    await actions.appendSection({
      id: "core-idea",
      kind: "markdown",
      title: "Core idea",
      content: "Attempt the transformation first.",
    });

    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe("/api/sessions/session-1/canvas");
    expect(request?.method).toBe("POST");
    expect(JSON.parse(String(request?.body))).toEqual({
      action: "append",
      section: {
        id: "core-idea",
        kind: "markdown",
        title: "Core idea",
        content: "Attempt the transformation first.",
      },
    });
    expect(order).toEqual(["persist", "broadcast"]);
  });

  it("links learner memory to the current turn", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ version: 1, entries: [] }),
    );
    const actions = createChalkPilotActions({
      sessionId: "session-1",
      fetcher,
      inspectBoard: vi.fn(),
      getEvidenceId: () => "turn-4",
      onCanvasChanged: vi.fn(),
    });

    await actions.rememberLearner({
      claim: "Benefits from drawing the state transition.",
      scope: "markov-chains",
      confidence: 0.8,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/sessions/session-1/memory",
      expect.objectContaining({
        body: JSON.stringify({
          claim: "Benefits from drawing the state transition.",
          scope: "markov-chains",
          confidence: 0.8,
          evidence: "turn-4",
        }),
      }),
    );
  });

  it("reports the result of a bounded board inspection", async () => {
    const inspectBoard = vi.fn(async () => "sent" as const);
    const actions = createChalkPilotActions({
      sessionId: "session-1",
      fetcher: vi.fn(),
      inspectBoard,
      getEvidenceId: () => "turn-1",
      onCanvasChanged: vi.fn(),
    });

    await expect(actions.inspectBoard()).resolves.toEqual({
      status: "sent",
      message: "The latest corrected board image is now available.",
    });
    expect(inspectBoard).toHaveBeenCalledOnce();
  });
});
