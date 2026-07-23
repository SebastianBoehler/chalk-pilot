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
      expect.arrayContaining(["sequence", "comparison", "chart", "checkpoint"]),
    );
    expect(curatedArtifactExamples).toHaveLength(4);
    for (const example of curatedArtifactExamples) {
      expect(canvasSectionInputSchema.parse(example)).toEqual(example);
    }
  });

  it("makes the examples concrete learning interactions rather than renamed prose", () => {
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
          { x: -1.2, y: 0.9, label: "cat" },
          { x: -0.8, y: 1.1, label: "dog" },
          { x: 1, y: -0.7, label: "run" },
          { x: 1.3, y: -1, label: "walk" },
        ]),
      },
    });
    expect(checkpoint).toMatchObject({
      kind: "checkpoint",
      data: { mode: "prediction", showAnswer: false, status: "unanswered" },
    });
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
