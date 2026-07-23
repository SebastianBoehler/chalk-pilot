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

  it("applies incremental state updates without losing the canvas", () => {
    const next = reduceDisplayState(
      { ...emptyDisplayState, synchronized: true },
      { version: 1, type: "agent_state", payload: "thinking" },
    );

    expect(next.agentState).toBe("thinking");
    expect(next.canvas).toEqual(emptyDisplayState.canvas);
  });
});
