import { describe, expect, it, vi } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { createChalkPilotActions } from "./tools";

const canvas: CanvasState = {
  version: 1,
  focusId: null,
  order: ["mechanism"],
  sections: {
    mechanism: {
      id: "mechanism",
      kind: "flow",
      title: "Pressure mechanism",
      data: {
        orientation: "horizontal",
        nodes: [
          {
            id: "pressure",
            title: "Pressure",
            detail: "A pressure difference moves fluid.",
          },
          { id: "flow", title: "Flow" },
        ],
        edges: [{ from: "pressure", to: "flow" }],
      },
      createdAt: "2026-07-24T08:00:00.000Z",
      updatedAt: "2026-07-24T08:00:00.000Z",
    },
  },
};

describe("ChalkPilot agent actions", () => {
  it("delegates durable canvas work without awaiting its completion", async () => {
    const delegateCanvas = vi.fn(() => ({ jobId: "job-1" }));
    const actions = createChalkPilotActions({
      sessionId: "session-1",
      fetcher: vi.fn(),
      delegateCanvas,
      inspectBoard: vi.fn(),
      getCanvas: () => canvas,
      getEvidenceId: () => "turn-1",
      onCanvasChanged: vi.fn(),
      onNavigation: vi.fn(),
    });

    await expect(
      actions.delegateCanvas({
        goal: "Add a comparison between ascent and descent.",
        artifact: "comparison",
      }),
    ).resolves.toEqual({
      accepted: true,
      jobId: "job-1",
    });
    expect(delegateCanvas).toHaveBeenCalledWith({
      goal: "Add a comparison between ascent and descent.",
      artifact: "comparison",
    });
  });

  it("accepts a trusted flow as a delegated learning-move artifact", async () => {
    const delegateCanvas = vi.fn(() => ({ jobId: "job-flow" }));
    const actions = createChalkPilotActions({
      sessionId: "session-1",
      fetcher: vi.fn(),
      delegateCanvas,
      inspectBoard: vi.fn(),
      getCanvas: () => canvas,
      getEvidenceId: () => "turn-1",
      onCanvasChanged: vi.fn(),
      onNavigation: vi.fn(),
    });

    await expect(
      actions.delegateCanvas({
        goal: "Show the causal mechanism without revealing a solution.",
        artifact: "flow",
      }),
    ).resolves.toMatchObject({ accepted: true, jobId: "job-flow" });
  });

  it("passes only a bounded list of canonical study chunks to the worker", async () => {
    const delegateCanvas = vi.fn(() => ({ jobId: "job-grounded" }));
    const actions = createChalkPilotActions({
      sessionId: "session-1",
      fetcher: vi.fn(),
      delegateCanvas,
      inspectBoard: vi.fn(),
      getCanvas: () => canvas,
      getEvidenceId: () => "turn-1",
      onCanvasChanged: vi.fn(),
      onNavigation: vi.fn(),
    });
    await actions.delegateCanvas({
      goal: "Compare the two definitions from the notes.",
      artifact: "comparison",
      sourceChunkIds: ["source-1-c-1", "source-1-c-2"],
    });
    expect(delegateCanvas).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceChunkIds: ["source-1-c-1", "source-1-c-2"],
      }),
    );

    await expect(
      actions.delegateCanvas({
        goal: "Too much material.",
        artifact: "comparison",
        sourceChunkIds: Array.from(
          { length: 6 },
          (_, index) => `chunk-${index}`,
        ),
      }),
    ).rejects.toThrow();
  });

  it("links learner memory to the current turn", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ version: 1, entries: [] }),
    );
    const actions = createChalkPilotActions({
      sessionId: "session-1",
      fetcher,
      delegateCanvas: vi.fn(),
      inspectBoard: vi.fn(),
      getCanvas: () => canvas,
      getEvidenceId: () => "turn-4",
      onCanvasChanged: vi.fn(),
      onNavigation: vi.fn(),
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
      delegateCanvas: vi.fn(),
      inspectBoard,
      getCanvas: () => canvas,
      getEvidenceId: () => "turn-1",
      onCanvasChanged: vi.fn(),
      onNavigation: vi.fn(),
    });

    await expect(actions.inspectBoard()).resolves.toEqual({
      status: "sent",
      message: "The latest corrected board image is now available.",
    });
    expect(inspectBoard).toHaveBeenCalledOnce();
  });
});
