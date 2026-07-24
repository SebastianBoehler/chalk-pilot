import { describe, expect, it, vi } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { createChalkPilotActions, createChalkPilotTools } from "./tools";

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

function navigationRuntime(overrides: Record<string, unknown> = {}) {
  const fetcher = vi.fn(async () => Response.json(canvas));
  const onNavigation = vi.fn();
  return {
    sessionId: "session-1",
    fetcher,
    onNavigation,
    delegateCanvas: vi.fn(),
    inspectBoard: vi.fn(),
    getCanvas: () => canvas,
    getEvidenceId: () => "turn-1",
    onCanvasChanged: vi.fn(),
    ...overrides,
  };
}

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

  it("exposes only bounded semantic canvas tools to the voice tutor", () => {
    const tools = createChalkPilotTools(navigationRuntime());

    expect(tools.map((item) => item.name)).toEqual([
      "inspect_board",
      "list_canvas_targets",
      "focus_canvas",
      "highlight_canvas",
      "delegate_canvas_task",
      "remember_learner",
    ]);
  });

  it("lists ordered, bounded semantic canvas targets without source data", async () => {
    const actions = createChalkPilotActions(navigationRuntime());

    await expect(actions.listCanvasTargets()).resolves.toEqual([
      {
        id: "mechanism",
        label: "Pressure mechanism",
        preview:
          "Pressure mechanism Pressure A pressure difference moves fluid. Flow",
      },
      {
        id: "mechanism:pressure",
        label: "Pressure",
        preview: "Pressure A pressure difference moves fluid.",
      },
      { id: "mechanism:flow", label: "Flow", preview: "Flow" },
    ]);
  });

  it("persists the owning section before emitting a fresh focus navigation", async () => {
    const runtime = navigationRuntime();
    const actions = createChalkPilotActions(runtime);

    await actions.focusCanvas({ targetId: "mechanism:pressure" });
    await actions.focusCanvas({ targetId: "mechanism:pressure" });

    expect(runtime.fetcher).toHaveBeenCalledWith(
      "/api/sessions/session-1/canvas",
      expect.objectContaining({
        body: JSON.stringify({ action: "focus", sectionId: "mechanism" }),
      }),
    );
    expect(runtime.onNavigation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        kind: "focus",
        targetId: "mechanism:pressure",
      }),
    );
    expect(runtime.onNavigation.mock.calls[0]?.[0].requestId).not.toBe(
      runtime.onNavigation.mock.calls[1]?.[0].requestId,
    );
  });

  it("rejects an unavailable canvas target before persisting or navigating", async () => {
    const runtime = navigationRuntime();
    const actions = createChalkPilotActions(runtime);

    await expect(actions.focusCanvas({ targetId: "missing" })).rejects.toThrow(
      "Canvas target is unavailable.",
    );
    expect(runtime.fetcher).not.toHaveBeenCalled();
    expect(runtime.onNavigation).not.toHaveBeenCalled();
  });

  it("does not navigate when focus persistence fails", async () => {
    const runtime = navigationRuntime({
      fetcher: vi.fn(async () =>
        Response.json({ error: "Focus could not persist." }, { status: 500 }),
      ),
    });
    const actions = createChalkPilotActions(runtime);

    await expect(
      actions.focusCanvas({ targetId: "mechanism:pressure" }),
    ).rejects.toThrow("ChalkPilot could not save that learning artifact.");
    expect(runtime.onNavigation).not.toHaveBeenCalled();
  });

  it("focuses but does not highlight text unavailable in the target", async () => {
    const runtime = navigationRuntime();
    const actions = createChalkPilotActions(runtime);

    await expect(
      actions.highlightCanvas({
        targetId: "mechanism:pressure",
        text: "unavailable text",
      }),
    ).resolves.toEqual({
      focused: true,
      highlighted: false,
      error: "Highlight text is unavailable.",
    });
    expect(runtime.fetcher).toHaveBeenCalledWith(
      "/api/sessions/session-1/canvas",
      expect.objectContaining({
        body: JSON.stringify({ action: "focus", sectionId: "mechanism" }),
      }),
    );
    expect(runtime.onNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "focus",
        targetId: "mechanism:pressure",
      }),
    );
  });

  it("highlights only an exact phrase available in the resolved target", async () => {
    const runtime = navigationRuntime();
    const actions = createChalkPilotActions(runtime);

    await expect(
      actions.highlightCanvas({
        targetId: "mechanism:pressure",
        text: "pressure difference",
      }),
    ).resolves.toEqual({ focused: true, highlighted: true });
    expect(runtime.onNavigation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "highlight",
        targetId: "mechanism:pressure",
        text: "pressure difference",
      }),
    );
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
