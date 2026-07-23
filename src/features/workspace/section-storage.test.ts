import { describe, expect, it } from "vitest";
import { canvasSectionInputSchema, canvasStateSchema } from "./schema";
import {
  payloadFileName,
  projectStoredCanvasState,
  serializeSectionPayload,
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

  it("selects JSON payloads for structured sections", () => {
    const chart = canvasSectionInputSchema.parse({
      id: "embedding-space",
      kind: "chart",
      title: "Embedding space",
      data: {
        variant: "scatter",
        series: [{ name: "Tokens", points: [{ x: 0, y: 0 }] }],
      },
    });

    expect(payloadFileName(chart)).toBe("embedding-space.json");
    expect(JSON.parse(serializeSectionPayload(chart))).toEqual({
      variant: "scatter",
      series: [{ name: "Tokens", points: [{ x: 0, y: 0 }] }],
    });
  });

  it("keeps markdown content in Markdown payloads", () => {
    const note = canvasSectionInputSchema.parse({
      id: "token-note",
      kind: "markdown",
      title: "Token note",
      content: "Tokenize first.",
    });

    expect(payloadFileName(note)).toBe("token-note.md");
    expect(serializeSectionPayload(note)).toBe("Tokenize first.");
  });
});
