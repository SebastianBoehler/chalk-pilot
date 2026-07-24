import { describe, expect, it } from "vitest";
import { parseDisplayMessage } from "./protocol";

describe("display protocol", () => {
  it("accepts structured artifacts in a versioned snapshot", () => {
    const message = parseDisplayMessage({
      version: 1,
      type: "snapshot",
      payload: {
        agentState: "speaking",
        navigation: {
          requestId: "navigation-1",
          targetId: "steps:recall",
          kind: "focus",
          issuedAt: "2026-07-23T10:00:00.000Z",
        },
        canvas: {
          version: 1,
          focusId: "steps",
          order: ["steps"],
          sections: {
            steps: {
              id: "steps",
              kind: "sequence",
              title: "Retrieval loop",
              createdAt: "2026-07-23T10:00:00.000Z",
              updatedAt: "2026-07-23T10:00:00.000Z",
              data: {
                activeStepId: "recall",
                reveal: "active",
                steps: [
                  {
                    id: "recall",
                    title: "Recall",
                    content: "Retrieve the idea before checking notes.",
                  },
                  {
                    id: "check",
                    title: "Check",
                    content: "Compare your attempt with the evidence.",
                  },
                ],
              },
            },
          },
        },
      },
    });

    expect(message).toMatchObject({
      type: "snapshot",
      payload: {
        agentState: "speaking",
        navigation: {
          requestId: "navigation-1",
          targetId: "steps:recall",
          kind: "focus",
        },
        canvas: {
          sections: {
            steps: { kind: "sequence", data: { reveal: "active" } },
          },
        },
      },
    });
  });

  it("accepts a semantic navigation request without canvas coordinates", () => {
    const message = parseDisplayMessage({
      version: 1,
      type: "navigation",
      payload: {
        requestId: "navigation-2",
        targetId: "steps:recall",
        kind: "highlight",
        text: "Retrieve the idea before checking notes.",
        issuedAt: "2026-07-23T10:02:00.000Z",
      },
    });

    expect(message).toMatchObject({
      type: "navigation",
      payload: {
        requestId: "navigation-2",
        targetId: "steps:recall",
        kind: "highlight",
      },
    });
  });

  it("accepts a structured canvas update without a new snapshot", () => {
    const message = parseDisplayMessage({
      version: 1,
      type: "canvas",
      payload: {
        version: 1,
        focusId: "check",
        order: ["check"],
        sections: {
          check: {
            id: "check",
            kind: "checkpoint",
            title: "Prediction",
            createdAt: "2026-07-23T10:00:00.000Z",
            updatedAt: "2026-07-23T10:01:00.000Z",
            data: {
              mode: "prediction",
              prompt: "What happens next?",
              expectedAnswer: "Retrieve before feedback.",
              status: "correct",
              showAnswer: true,
              showFeedback: false,
              showHint: false,
            },
          },
        },
      },
    });

    expect(message).toMatchObject({
      type: "canvas",
      payload: {
        focusId: "check",
        sections: {
          check: {
            kind: "checkpoint",
            data: { showAnswer: true, status: "correct" },
          },
        },
      },
    });
  });

  it("rejects a malformed structured artifact", () => {
    expect(
      parseDisplayMessage({
        version: 1,
        type: "canvas",
        payload: {
          version: 1,
          focusId: "broken",
          order: ["broken"],
          sections: {
            broken: {
              id: "broken",
              kind: "chart",
              title: "Broken",
              createdAt: "2026-07-23T10:00:00.000Z",
              updatedAt: "2026-07-23T10:00:00.000Z",
              data: { variant: "line", series: [] },
            },
          },
        },
      }),
    ).toBeNull();
  });
});
