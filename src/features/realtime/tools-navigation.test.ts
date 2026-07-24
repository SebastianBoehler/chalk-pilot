import { describe, expect, it, vi } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { createChalkPilotActions, createChalkPilotTools } from "./tools";

const timestamp = "2026-07-24T08:00:00.000Z";
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
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
};

function runtime(
  current: CanvasState = canvas,
  overrides: Record<string, unknown> = {},
) {
  return {
    sessionId: "session-1",
    fetcher: vi.fn(async () => Response.json(current)),
    onNavigation: vi.fn(),
    delegateCanvas: vi.fn(),
    inspectBoard: vi.fn(),
    getCanvas: () => current,
    getEvidenceId: () => "turn-1",
    onCanvasChanged: vi.fn(),
    ...overrides,
  };
}

describe("semantic canvas tools", () => {
  it("exposes the bounded semantic tool surface in stable order", () => {
    expect(createChalkPilotTools(runtime()).map(({ name }) => name)).toEqual([
      "inspect_board",
      "list_canvas_targets",
      "focus_canvas",
      "highlight_canvas",
      "delegate_canvas_task",
      "remember_learner",
    ]);
  });

  it("lists safe semantic previews and repeats focus with fresh requests", async () => {
    const context = runtime();
    const actions = createChalkPilotActions(context);

    await expect(actions.listCanvasTargets()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "mechanism",
          artifactType: "flow",
        }),
      ]),
    );
    await actions.focusCanvas({ targetId: "mechanism:pressure" });
    await actions.focusCanvas({ targetId: "mechanism:pressure" });

    expect(context.onNavigation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        kind: "focus",
        targetId: "mechanism:pressure",
      }),
      canvas,
    );
    expect(context.onNavigation.mock.calls[0]?.[0].requestId).not.toBe(
      context.onNavigation.mock.calls[1]?.[0].requestId,
    );
  });

  it("rejects unknown targets and failed persistence without navigating", async () => {
    const unavailable = runtime();
    await expect(
      createChalkPilotActions(unavailable).focusCanvas({ targetId: "missing" }),
    ).rejects.toThrow("Canvas target is unavailable.");
    expect(unavailable.fetcher).not.toHaveBeenCalled();
    expect(unavailable.onNavigation).not.toHaveBeenCalled();

    const failed = runtime(canvas, {
      fetcher: vi.fn(async () =>
        Response.json({ error: "No." }, { status: 500 }),
      ),
    });
    await expect(
      createChalkPilotActions(failed).focusCanvas({
        targetId: "mechanism:pressure",
      }),
    ).rejects.toThrow("ChalkPilot could not save that learning artifact.");
    expect(failed.onNavigation).not.toHaveBeenCalled();
  });

  it("revalidates a target against the authoritative mutated canvas", async () => {
    const mechanism = canvas.sections.mechanism;
    if (mechanism?.kind !== "flow") throw new Error("Expected flow fixture.");
    const changed: CanvasState = {
      ...canvas,
      sections: {
        mechanism: {
          ...mechanism,
          data: {
            ...mechanism.data,
            nodes: [
              { id: "replacement", title: "Replacement" },
              { id: "flow", title: "Flow" },
            ],
            edges: [{ from: "replacement", to: "flow" }],
          },
        },
      },
    };
    const context = runtime(canvas, {
      fetcher: vi.fn(async () => Response.json(changed)),
    });

    await expect(
      createChalkPilotActions(context).focusCanvas({
        targetId: "mechanism:pressure",
      }),
    ).rejects.toThrow("Canvas target is unavailable.");
    expect(context.onCanvasChanged).toHaveBeenCalledWith(changed);
    expect(context.onNavigation).not.toHaveBeenCalled();
  });

  it("revalidates highlight text after persistence", async () => {
    const mechanism = canvas.sections.mechanism;
    if (mechanism?.kind !== "flow") throw new Error("Expected flow fixture.");
    const changed: CanvasState = {
      ...canvas,
      sections: {
        mechanism: {
          ...mechanism,
          data: {
            ...mechanism.data,
            nodes: [
              {
                id: "pressure",
                title: "Pressure",
                detail: "The explanation changed.",
              },
              { id: "flow", title: "Flow" },
            ],
          },
        },
      },
    };
    const context = runtime(canvas, {
      fetcher: vi.fn(async () => Response.json(changed)),
    });

    await expect(
      createChalkPilotActions(context).highlightCanvas({
        targetId: "mechanism:pressure",
        text: "pressure difference",
      }),
    ).resolves.toEqual({
      focused: true,
      highlighted: false,
      error: "Highlight text is unavailable.",
    });
    expect(context.onNavigation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "focus" }),
      changed,
    );
  });

  it("approves rendered plain text but rejects raw Markdown syntax", async () => {
    const plain = runtime();
    await expect(
      createChalkPilotActions(plain).highlightCanvas({
        targetId: "mechanism:pressure",
        text: "pressure difference",
      }),
    ).resolves.toEqual({ focused: true, highlighted: true });

    const markdownCanvas: CanvasState = {
      version: 1,
      focusId: null,
      order: ["explanation"],
      sections: {
        explanation: {
          id: "explanation",
          kind: "markdown",
          title: "Explanation",
          content: "Use **pressure** to reason.",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    };
    const markdown = runtime(markdownCanvas);
    await expect(
      createChalkPilotActions(markdown).highlightCanvas({
        targetId: "explanation",
        text: "**pressure**",
      }),
    ).resolves.toEqual({
      focused: true,
      highlighted: false,
      error: "Highlight text is unavailable.",
    });
  });
});
