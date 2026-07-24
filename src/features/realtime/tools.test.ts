import { describe, expect, it, vi } from "vitest";
import { createChalkPilotActions, createChalkPilotTools } from "./tools";

describe("ChalkPilot agent actions", () => {
  it("delegates durable canvas work without awaiting its completion", async () => {
    const delegateCanvas = vi.fn(() => ({ jobId: "job-1" }));
    const actions = createChalkPilotActions({
      sessionId: "session-1",
      fetcher: vi.fn(),
      delegateCanvas,
      inspectBoard: vi.fn(),
      getEvidenceId: () => "turn-1",
      onCanvasChanged: vi.fn(),
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

  it("does not expose direct canvas-writing tools to the voice tutor", () => {
    const tools = createChalkPilotTools({
      sessionId: "session-1",
      delegateCanvas: vi.fn(),
      inspectBoard: vi.fn(),
      getEvidenceId: () => "turn-1",
      onCanvasChanged: vi.fn(),
    });

    expect(tools.map((item) => item.name)).toEqual([
      "inspect_board",
      "set_focus",
      "delegate_canvas_task",
      "remember_learner",
    ]);
  });

  it("accepts a trusted flow as a delegated learning-move artifact", async () => {
    const delegateCanvas = vi.fn(() => ({ jobId: "job-flow" }));
    const actions = createChalkPilotActions({
      sessionId: "session-1",
      fetcher: vi.fn(),
      delegateCanvas,
      inspectBoard: vi.fn(),
      getEvidenceId: () => "turn-1",
      onCanvasChanged: vi.fn(),
    });

    await expect(
      actions.delegateCanvas({
        goal: "Show the causal mechanism without revealing a solution.",
        artifact: "flow",
      }),
    ).resolves.toMatchObject({ accepted: true, jobId: "job-flow" });
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
      delegateCanvas: vi.fn(),
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
