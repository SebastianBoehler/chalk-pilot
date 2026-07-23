import { describe, expect, it } from "vitest";
import { canvasSectionInputSchema, canvasStateSchema } from "./schema";
import {
  projectStoredCanvasState,
  restoreTextSection,
  requireTextSection,
  requireTextSectionKind,
} from "./section-storage";

describe("section storage boundary", () => {
  it("projects text canvas sections to metadata only", () => {
    const stored = projectStoredCanvasState(
      canvasStateSchema.parse({
        version: 1,
        focusId: "token-note",
        order: ["token-note"],
        sections: {
          "token-note": {
            id: "token-note",
            kind: "markdown",
            title: "Token note",
            content: "Tokenize first.",
            createdAt: "2026-07-23T10:00:00.000Z",
            updatedAt: "2026-07-23T10:00:00.000Z",
          },
        },
      }),
    );

    expect(stored.sections["token-note"]).toEqual({
      id: "token-note",
      kind: "markdown",
      title: "Token note",
      createdAt: "2026-07-23T10:00:00.000Z",
      updatedAt: "2026-07-23T10:00:00.000Z",
    });
  });

  it("keeps structured sections outside text storage until JSON persistence exists", () => {
    const chart = canvasSectionInputSchema.parse({
      id: "embedding-space",
      kind: "chart",
      title: "Embedding space",
      data: {
        variant: "scatter",
        series: [{ name: "Tokens", points: [{ x: 0, y: 0 }] }],
      },
    });

    expect(() => requireTextSection(chart)).toThrow(
      "Structured canvas sections are not available yet",
    );
    expect(() => requireTextSectionKind("chart")).toThrow(
      "Structured canvas sections are not available yet",
    );
    expect(() =>
      restoreTextSection(
        {
          id: chart.id,
          kind: chart.kind,
          title: chart.title,
          createdAt: "2026-07-23T10:00:00.000Z",
          updatedAt: "2026-07-23T10:00:00.000Z",
        },
        "not a markdown fallback",
      ),
    ).toThrow("Structured canvas sections are not available yet");
    expect(() =>
      projectStoredCanvasState(
        canvasStateSchema.parse({
          version: 1,
          focusId: chart.id,
          order: [chart.id],
          sections: {
            [chart.id]: {
              ...chart,
              createdAt: "2026-07-23T10:00:00.000Z",
              updatedAt: "2026-07-23T10:00:00.000Z",
            },
          },
        }),
      ),
    ).toThrow("Structured canvas sections are not available yet");
  });
});
