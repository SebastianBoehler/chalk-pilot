// @vitest-environment node

import { describe, expect, it } from "vitest";
import { canvasSectionInputSchema } from "@/features/workspace/schema";
import {
  artifactPlaybookInstructions,
  curatedArtifactExamples,
} from "./artifact-playbook";

describe("canvas artifact playbook", () => {
  it("supplies one valid pedagogical example for every structured artifact", () => {
    const kinds = curatedArtifactExamples.map((example) => example.kind);

    expect(kinds).toEqual(
      expect.arrayContaining([
        "flow",
        "sequence",
        "comparison",
        "chart",
        "checkpoint",
      ]),
    );
    expect(curatedArtifactExamples).toHaveLength(5);
    for (const example of curatedArtifactExamples) {
      expect(canvasSectionInputSchema.parse(example)).toEqual(example);
    }
  });

  it("uses cross-domain learning interactions rather than a subject template", () => {
    const examples = JSON.stringify(curatedArtifactExamples).toLowerCase();
    const chart = curatedArtifactExamples.find(
      (example) => example.kind === "chart",
    );
    const checkpoint = curatedArtifactExamples.find(
      (example) => example.kind === "checkpoint",
    );

    expect(chart).toMatchObject({
      kind: "chart",
      data: {
        variant: "scatter",
        series: [{ points: expect.any(Array) }],
        annotations: expect.arrayContaining([
          {
            x: 80,
            y: 60,
            label: "Four times the 20 km/h distance",
          },
        ]),
      },
    });
    expect(checkpoint).toMatchObject({
      kind: "checkpoint",
      data: { mode: "prediction", showAnswer: false, status: "unanswered" },
    });
    expect(examples).not.toMatch(/token|embedding|nlp|language model/);
  });

  it("distinguishes a conceptual mechanism flow from a progressive procedure", () => {
    const flow = curatedArtifactExamples.find(
      (example) => example.kind === "flow",
    );
    const sequence = curatedArtifactExamples.find(
      (example) => example.kind === "sequence",
    );

    expect(flow).toMatchObject({
      kind: "flow",
      data: {
        nodes: expect.any(Array),
        edges: expect.any(Array),
      },
    });
    expect(sequence).toMatchObject({
      kind: "sequence",
      data: {
        steps: expect.any(Array),
        reveal: "through-active",
      },
    });
    expect(artifactPlaybookInstructions).toContain(
      "mechanism, transformation, causal chain, or architecture",
    );
    expect(artifactPlaybookInstructions).toContain(
      "progressively revealed procedure",
    );
  });

  it("directs the worker toward one focused, safe visual update", () => {
    expect(artifactPlaybookInstructions).toContain(
      "exactly one focal artifact",
    );
    expect(artifactPlaybookInstructions).toContain(
      "update that stable ID before appending",
    );
    expect(artifactPlaybookInstructions).toContain(
      "Focus only after a successful upsert",
    );
    expect(artifactPlaybookInstructions).toContain("Voice agent owns dialogue");
    expect(artifactPlaybookInstructions).toContain(
      "worker owns durable visual output",
    );
    expect(artifactPlaybookInstructions).toContain("No renamed prose cards");
    expect(artifactPlaybookInstructions).toContain(
      "Do not use Markdown or ASCII",
    );
    expect(artifactPlaybookInstructions).toContain(
      "Do not describe a plot in prose",
    );
    expect(artifactPlaybookInstructions).toContain("No decorative chart");
    expect(artifactPlaybookInstructions).toContain("Never invent a URL");
    expect(artifactPlaybookInstructions).toContain(
      "Never promise or emit raw HTML",
    );
    expect(artifactPlaybookInstructions).toContain(
      "Do not emit uncertain Mermaid",
    );
  });
});
