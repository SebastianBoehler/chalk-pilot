import { describe, expect, it } from "vitest";
import {
  emptyDisplayState,
  reduceDisplayState,
  type DisplayMessage,
} from "./display-reducer";

describe("display reducer", () => {
  it("hydrates the display from a controller snapshot", () => {
    const message: DisplayMessage = {
      version: 1,
      type: "snapshot",
      payload: {
        agentState: "listening",
        navigation: null,
        canvas: {
          version: 1,
          focusId: "attempt",
          order: ["attempt"],
          sections: {
            attempt: {
              id: "attempt",
              kind: "markdown",
              title: "Your attempt",
              content: "Explain the next step.",
              createdAt: "2026-07-23T10:00:00.000Z",
              updatedAt: "2026-07-23T10:00:00.000Z",
            },
          },
        },
      },
    };

    expect(reduceDisplayState(emptyDisplayState, message)).toMatchObject({
      agentState: "listening",
      canvas: { focusId: "attempt" },
      synchronized: true,
    });
  });

  it("stores navigation without replacing the canvas or agent state", () => {
    const state = {
      ...emptyDisplayState,
      agentState: "speaking" as const,
      synchronized: true,
    };
    const navigation = {
      requestId: "navigation-1",
      targetId: "attempt",
      kind: "focus" as const,
      issuedAt: "2026-07-23T10:00:00.000Z",
    };

    const next = reduceDisplayState(state, {
      version: 1,
      type: "navigation",
      payload: navigation,
    });

    expect(next.navigation).toEqual(navigation);
    expect(next.canvas).toBe(state.canvas);
    expect(next.agentState).toBe(state.agentState);
  });

  it("applies incremental state updates without losing the canvas", () => {
    const next = reduceDisplayState(
      { ...emptyDisplayState, synchronized: true },
      { version: 1, type: "agent_state", payload: "thinking" },
    );

    expect(next.agentState).toBe("thinking");
    expect(next.canvas).toEqual(emptyDisplayState.canvas);
  });

  it("keeps trusted structured artifacts when a snapshot hydrates the display", () => {
    const next = reduceDisplayState(emptyDisplayState, {
      version: 1,
      type: "snapshot",
      payload: {
        agentState: "thinking",
        navigation: null,
        canvas: {
          version: 1,
          focusId: "learning-gain",
          order: ["learning-gain"],
          sections: {
            "learning-gain": {
              id: "learning-gain",
              kind: "chart",
              title: "Learning gain",
              createdAt: "2026-07-23T10:00:00.000Z",
              updatedAt: "2026-07-23T10:00:00.000Z",
              data: {
                variant: "line",
                series: [
                  {
                    name: "Recall",
                    points: [
                      { x: 1, y: 32 },
                      { x: 2, y: 61 },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    });

    expect(next).toMatchObject({
      agentState: "thinking",
      synchronized: true,
      canvas: {
        focusId: "learning-gain",
        sections: {
          "learning-gain": {
            kind: "chart",
            data: { variant: "line" },
          },
        },
      },
    });
  });
});
