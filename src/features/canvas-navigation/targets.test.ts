import { describe, expect, it } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { canvasNavigationSchema, createCanvasNavigation } from "./schema";
import { listCanvasTargets, resolveCanvasTarget } from "./targets";

const timestamp = "2026-07-24T08:00:00.000Z";

const canvas: CanvasState = {
  version: 1,
  focusId: null,
  order: ["mechanism", "procedure", "prediction", "trend"],
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
    procedure: {
      id: "procedure",
      kind: "sequence",
      title: "Measurement procedure",
      data: {
        steps: [
          {
            id: "measure",
            title: "Measure",
            content: "Record the starting pressure.",
          },
          { id: "compare", title: "Compare", content: "Compare the values." },
        ],
        activeStepId: "measure",
        reveal: "all",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    prediction: {
      id: "prediction",
      kind: "checkpoint",
      title: "Prediction",
      data: {
        mode: "prediction",
        prompt: "What happens when pressure increases?",
        status: "unanswered",
        showHint: false,
        showAnswer: false,
        showFeedback: false,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    trend: {
      id: "trend",
      kind: "chart",
      title: "Pressure trend",
      data: {
        variant: "line",
        series: [
          {
            name: "Pressure",
            points: [
              { x: 1, y: 2 },
              { x: 2, y: 4 },
            ],
          },
        ],
        annotations: [
          { id: "threshold", x: 2, y: 4, label: "Critical threshold" },
          { x: 1, label: "Unaddressable label" },
        ],
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
};

describe("semantic canvas targets", () => {
  it("lists section and nested targets in stable canvas order", () => {
    expect(listCanvasTargets(canvas).map(({ id }) => id)).toEqual([
      "mechanism",
      "mechanism:pressure",
      "mechanism:flow",
      "procedure",
      "procedure:measure",
      "procedure:compare",
      "prediction",
      "prediction:prompt",
      "trend",
      "trend:threshold",
    ]);
  });

  it("keeps each target's complete render-relevant text for validation", () => {
    expect(resolveCanvasTarget(canvas, "mechanism:pressure")).toEqual({
      id: "mechanism:pressure",
      sectionId: "mechanism",
      label: "Pressure",
      text: "Pressure\nA pressure difference moves fluid.",
    });
    expect(resolveCanvasTarget(canvas, "procedure:measure")).toMatchObject({
      text: "Measure\nRecord the starting pressure.",
    });
    expect(resolveCanvasTarget(canvas, "prediction:prompt")).toMatchObject({
      text: "What happens when pressure increases?",
    });
    expect(resolveCanvasTarget(canvas, "trend:threshold")).toMatchObject({
      text: "Critical threshold",
    });
  });

  it("rejects unavailable targets", () => {
    expect(() => resolveCanvasTarget(canvas, "missing")).toThrow(
      "Canvas target is unavailable.",
    );
  });
});

describe("canvas navigation schema", () => {
  it("parses strict semantic navigation IDs", () => {
    expect(
      canvasNavigationSchema.parse({
        requestId: "nav-1",
        targetId: "mechanism:pressure",
        kind: "focus",
        issuedAt: timestamp,
      }),
    ).toMatchObject({ targetId: "mechanism:pressure" });
    expect(() =>
      canvasNavigationSchema.parse({
        requestId: "nav-1",
        targetId: "mechanism:pressure:detail",
        kind: "focus",
        issuedAt: timestamp,
      }),
    ).toThrow();
  });

  it("creates a deterministic, validated navigation request", () => {
    expect(
      createCanvasNavigation(
        { targetId: "mechanism:pressure", kind: "highlight", text: "Pressure" },
        {
          createId: () => "nav-1",
          now: () => new Date(timestamp),
        },
      ),
    ).toEqual({
      requestId: "nav-1",
      targetId: "mechanism:pressure",
      kind: "highlight",
      text: "Pressure",
      issuedAt: timestamp,
    });
  });
});
