import { describe, expect, it } from "vitest";
import {
  buildChalkPilotInstructions,
  chalkPilotInstructions,
} from "./instructions";

describe("ChalkPilot instructions", () => {
  it("inventories artifact types before choosing a genuinely different one", () => {
    expect(chalkPilotInstructions).toContain(
      "asks for a new, different, or unused artifact type",
    );
    expect(chalkPilotInstructions).toContain("artifactType");
    expect(chalkPilotInstructions).toContain(
      "flow, chart, comparison, sequence, and checkpoint",
    );
  });

  it("keeps voice brief and protects the learner's attempt", () => {
    expect(chalkPilotInstructions).toContain("one or two sentences");
    expect(chalkPilotInstructions).toContain("attempt");
    expect(chalkPilotInstructions).toContain("canvas");
    expect(chalkPilotInstructions).toContain("inspect");
    expect(chalkPilotInstructions).toContain("unreadable");
  });

  it("encodes the attempt-first teaching loop as a flexible voice policy", () => {
    expect(chalkPilotInstructions).toContain("current attempt");
    expect(chalkPilotInstructions).toContain("board evidence");
    expect(chalkPilotInstructions).toContain("one concise spoken cue");
    expect(chalkPilotInstructions).toContain("one focal artifact");
    expect(chalkPilotInstructions).toContain("checkpoint or transfer");
    expect(chalkPilotInstructions).toContain("flexible policy");
    expect(chalkPilotInstructions).toContain("not a rigid state machine");
  });

  it("routes artifacts by the learning move rather than the subject", () => {
    expect(chalkPilotInstructions).toContain("mechanism or causal chain");
    expect(chalkPilotInstructions).toContain("quantitative relationship");
    expect(chalkPilotInstructions).toContain("distinction or trade-off");
    expect(chalkPilotInstructions).toContain(
      "progressively revealed procedure",
    );
    expect(chalkPilotInstructions).toContain(
      "prediction, retrieval, classification, or transfer",
    );
    expect(chalkPilotInstructions).toContain("not by subject");
  });

  it("uses registered targets only for material teaching moves", () => {
    expect(chalkPilotInstructions).toContain("list_canvas_targets");
    expect(chalkPilotInstructions).toContain("materially supports");
    expect(chalkPilotInstructions).toContain("tool result");
  });

  it("grounds a selected course first and labels outside knowledge", () => {
    const instructions = buildChalkPilotInstructions({
      id: "pack-1",
      title: "Probabilistic ML",
      sources: [
        {
          id: "source-1",
          packId: "pack-1",
          title: "Lecture 4",
          fileName: "lecture-4.md",
          format: "markdown",
          mimeType: "text/markdown",
          sizeBytes: 100,
          chunkCount: 1,
          locators: ["Variational inference"],
          createdAt: "2026-07-24T08:00:00.000Z",
        },
      ],
    });

    expect(instructions).toContain("Search before answering");
    expect(instructions).toContain("primary reference");
    expect(instructions).toContain('"Supplemental context"');
    expect(instructions).toContain("without retrieved evidence");
    expect(instructions).toContain("sourceChunkIds");
    expect(instructions).toContain("Lecture 4");
  });

  it("does not imply course verification without a selected pack", () => {
    expect(buildChalkPilotInstructions()).toContain(
      "do not imply that course-specific material was checked",
    );
  });
});
