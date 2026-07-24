import { describe, expect, it } from "vitest";
import {
  checkpointArtifactDataSchema,
  comparisonArtifactDataSchema,
  flowArtifactDataSchema,
  sequenceArtifactDataSchema,
} from "./artifact-schemas";
import { canvasSectionInputSchema } from "./schema";

describe("structured learning artifact schemas", () => {
  it("accepts a semantic comparison and rejects invalid columns or style fields", () => {
    const comparison = comparisonArtifactDataSchema.parse({
      columns: [
        {
          heading: "Word tokens",
          summary: "Intuitive whole words.",
          points: ["Large vocabulary"],
          emphasis: "caution",
        },
        {
          heading: "Subword tokens",
          summary: "Reusable word pieces.",
          points: ["Handles new words"],
          emphasis: "positive",
        },
      ],
    });

    expect(comparison.columns).toHaveLength(2);
    expect(() =>
      comparisonArtifactDataSchema.parse({
        columns: [{ heading: "Only", summary: "One column", points: [] }],
      }),
    ).toThrow();
    expect(() =>
      comparisonArtifactDataSchema.parse({
        columns: [
          { heading: "A", summary: "One", points: [], css: "color:red" },
          { heading: "B", summary: "Two", points: [] },
        ],
      }),
    ).toThrow();
  });

  it("accepts a progressive sequence and rejects duplicate or unknown active steps", () => {
    const sequence = sequenceArtifactDataSchema.parse({
      steps: [
        { id: "tokenize", title: "Tokenize", content: "Split the text." },
        { id: "embed", title: "Embed", content: "Map IDs to vectors." },
      ],
      activeStepId: "embed",
      reveal: "through-active",
    });

    expect(sequence.activeStepId).toBe("embed");
    expect(() =>
      sequenceArtifactDataSchema.parse({
        ...sequence,
        activeStepId: "missing",
      }),
    ).toThrow();
    expect(() =>
      sequenceArtifactDataSchema.parse({
        ...sequence,
        steps: [
          ...sequence.steps,
          { id: "embed", title: "Repeat", content: "Duplicate ID." },
        ],
      }),
    ).toThrow();
  });

  it("accepts a bounded directed flow and rejects invalid graph structure", () => {
    const flow = {
      orientation: "horizontal",
      nodes: [
        { id: "input", title: "Input", detail: "Start with evidence." },
        { id: "transform", title: "Transform" },
        { id: "result", title: "Result" },
      ],
      edges: [
        { from: "input", to: "transform", label: "changes through" },
        { from: "transform", to: "result" },
      ],
      activeNodeId: "transform",
    } as const;

    expect(flowArtifactDataSchema.parse(flow)).toEqual(flow);
    expect(() =>
      flowArtifactDataSchema.parse({
        ...flow,
        nodes: [...flow.nodes, { id: "input", title: "Duplicate" }],
      }),
    ).toThrow(/unique/i);
    expect(() =>
      flowArtifactDataSchema.parse({
        ...flow,
        edges: [{ from: "input", to: "missing" }],
      }),
    ).toThrow(/existing node/i);
    expect(() =>
      flowArtifactDataSchema.parse({
        ...flow,
        edges: [{ from: "input", to: "input" }],
      }),
    ).toThrow(/itself/i);
    expect(() =>
      flowArtifactDataSchema.parse({
        ...flow,
        edges: [
          { from: "input", to: "transform" },
          { from: "input", to: "transform" },
        ],
      }),
    ).toThrow(/unique/i);
    expect(() =>
      flowArtifactDataSchema.parse({
        ...flow,
        edges: [
          { from: "input", to: "transform" },
          { from: "transform", to: "result" },
          { from: "result", to: "input" },
        ],
      }),
    ).toThrow(/acyclic/i);
    expect(() =>
      flowArtifactDataSchema.parse({ ...flow, activeNodeId: "missing" }),
    ).toThrow(/active node/i);
    expect(() =>
      flowArtifactDataSchema.parse({ ...flow, html: "<button>Run</button>" }),
    ).toThrow();
  });

  it("accepts a stateful checkpoint and rejects one choice or arbitrary callbacks", () => {
    const checkpoint = checkpointArtifactDataSchema.parse({
      mode: "prediction",
      prompt: "Which tokenization handles unseen words best?",
      choices: ["Word", "Subword", "Character"],
      hint: "Think about reusable pieces.",
      expectedAnswer: "Subword",
      feedback: "Subwords reuse familiar fragments.",
      status: "unanswered",
      showHint: false,
      showAnswer: false,
      showFeedback: false,
    });

    expect(checkpoint.choices).toHaveLength(3);
    const freeResponseCheckpoint = { ...checkpoint };
    delete freeResponseCheckpoint.choices;
    expect(
      checkpointArtifactDataSchema.parse(freeResponseCheckpoint).choices,
    ).toBeUndefined();
    expect(() =>
      checkpointArtifactDataSchema.parse({ ...checkpoint, choices: ["Only"] }),
    ).toThrow();
    expect(() =>
      checkpointArtifactDataSchema.parse({
        ...checkpoint,
        onAnswer: "alert(1)",
      }),
    ).toThrow();
  });

  it("uses data for structured canvas sections and rejects raw HTML payloads", () => {
    expect(
      canvasSectionInputSchema.parse({
        id: "token-choices",
        kind: "comparison",
        title: "Token choices",
        data: {
          columns: [
            { heading: "Word", summary: "Whole words", points: [] },
            { heading: "Subword", summary: "Word pieces", points: [] },
          ],
        },
      }),
    ).toMatchObject({ kind: "comparison" });

    expect(() =>
      canvasSectionInputSchema.parse({
        id: "unsafe-canvas",
        kind: "chart",
        title: "Unsafe chart",
        data: {
          variant: "bar",
          series: [{ name: "Values", points: [{ x: "A", y: 1 }] }],
          html: "<script>alert(1)</script>",
        },
      }),
    ).toThrow();

    expect(
      canvasSectionInputSchema.parse({
        id: "mechanism",
        kind: "flow",
        title: "How the mechanism works",
        data: {
          orientation: "vertical",
          nodes: [
            { id: "cause", title: "Cause" },
            { id: "effect", title: "Effect" },
          ],
          edges: [{ from: "cause", to: "effect", label: "produces" }],
        },
      }),
    ).toMatchObject({ kind: "flow" });
  });
});
