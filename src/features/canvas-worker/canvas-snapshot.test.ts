// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { projectCanvasSnapshot } from "./canvas-snapshot";

const timestamp = "2026-07-23T08:00:00.000Z";
const long = "x".repeat(10_000);

function section(id: string, kind: "markdown" | "math" = "markdown") {
  return {
    id,
    kind,
    title: long,
    content: long,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const canvas: CanvasState = {
  version: 1,
  focusId: "checkpoint",
  order: [
    "oldest",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "chart",
    "comparison",
    "flow",
    "sequence",
    "checkpoint",
  ],
  sections: {
    oldest: section("oldest"),
    one: {
      id: "one",
      kind: "image",
      title: long,
      content: `https://example.com/${long}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    two: section("two"),
    three: section("three"),
    four: section("four"),
    five: section("five"),
    six: section("six"),
    seven: section("seven"),
    chart: {
      id: "chart",
      kind: "chart",
      title: long,
      data: {
        variant: "scatter",
        xLabel: long,
        yLabel: long,
        series: [
          {
            name: long,
            points: Array.from({ length: 100 }, (_, index) => ({
              x: index,
              y: index,
              label: long,
            })),
          },
        ],
        annotations: Array.from({ length: 8 }, (_, index) => ({
          id: `annotation-${index}`,
          x: index,
          y: index,
          label: long,
        })),
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    comparison: {
      id: "comparison",
      kind: "comparison",
      title: long,
      data: {
        columns: Array.from({ length: 4 }, (_, index) => ({
          heading: `${index}-${long}`,
          summary: long,
          points: Array.from({ length: 5 }, () => long),
        })),
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    flow: {
      id: "flow",
      kind: "flow",
      title: long,
      data: {
        orientation: "horizontal",
        nodes: [
          { id: "cause", title: long, detail: long },
          { id: "mechanism", title: long, detail: long },
          { id: "effect", title: long, detail: long },
        ],
        edges: [
          { from: "cause", to: "mechanism", label: long },
          { from: "mechanism", to: "effect", label: long },
        ],
        activeNodeId: "mechanism",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    sequence: {
      id: "sequence",
      kind: "sequence",
      title: long,
      data: {
        steps: Array.from({ length: 8 }, (_, index) => ({
          id: `step-${index}`,
          title: long,
          content: long,
        })),
        activeStepId: "step-7",
        reveal: "all",
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    checkpoint: {
      id: "checkpoint",
      kind: "checkpoint",
      title: long,
      data: {
        mode: "prediction",
        prompt: long,
        choices: Array.from({ length: 6 }, () => long.slice(0, 240)),
        hint: long,
        expectedAnswer: long,
        feedback: long,
        status: "unanswered",
        showHint: false,
        showAnswer: false,
        showFeedback: false,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
};

describe("canvas snapshot projection", () => {
  it("keeps kind-specific data shape while bounding the largest valid canvas", () => {
    const snapshot = projectCanvasSnapshot(canvas);
    const chart = snapshot.sections.find((item) => item.kind === "chart");
    const comparison = snapshot.sections.find(
      (item) => item.kind === "comparison",
    );
    const flow = snapshot.sections.find((item) => item.kind === "flow");
    const sequence = snapshot.sections.find((item) => item.kind === "sequence");
    const checkpoint = snapshot.sections.find(
      (item) => item.kind === "checkpoint",
    );
    const image = snapshot.sections.find((item) => item.kind === "image");
    const markdown = snapshot.sections.find((item) => item.kind === "markdown");

    expect(snapshot.sections).toHaveLength(12);
    expect(snapshot.sections.some((item) => item.id === "oldest")).toBe(false);
    if (!markdown || !("content" in markdown))
      throw new Error("Missing markdown");
    if (!image || !("content" in image)) throw new Error("Missing image");
    expect(markdown.content.length).toBeLessThan(long.length);
    expect(image.content.length).toBeLessThan(long.length);
    expect(chart).toMatchObject({
      kind: "chart",
      data: { variant: "scatter" },
    });
    expect(chart?.data.series[0]?.points.length).toBeLessThan(100);
    expect(chart?.data.annotations?.length).toBeLessThan(8);
    expect(comparison?.data.columns[0]?.points.length).toBeLessThan(5);
    expect(flow).toMatchObject({
      kind: "flow",
      data: {
        orientation: "horizontal",
        activeNodeId: "mechanism",
        edges: expect.arrayContaining([
          expect.objectContaining({ from: "cause", to: "mechanism" }),
        ]),
      },
    });
    expect(flow?.data.nodes[0]?.detail?.length).toBeLessThan(long.length);
    expect(flow?.data.edges[0]?.label?.length).toBeLessThan(long.length);
    expect(sequence).toMatchObject({
      kind: "sequence",
      data: { activeStepId: "step-7", reveal: "all" },
    });
    expect(sequence?.data.steps[0]?.content.length).toBeLessThan(long.length);
    expect(checkpoint).toMatchObject({
      kind: "checkpoint",
      data: { status: "unanswered", showAnswer: false },
    });
    expect(checkpoint?.data.prompt.length).toBeLessThan(long.length);
    expect(snapshot.targets).toEqual(
      expect.arrayContaining([
        {
          id: "chart:annotation-0",
          sectionId: "chart",
          label: long.slice(0, 120),
        },
        { id: "flow:cause", sectionId: "flow", label: long.slice(0, 120) },
        {
          id: "sequence:step-0",
          sectionId: "sequence",
          label: long.slice(0, 120),
        },
        { id: "checkpoint:prompt", sectionId: "checkpoint", label: "Prompt" },
      ]),
    );
    expect(snapshot.targets[0]).toEqual({
      id: "one",
      sectionId: "one",
      label: long.slice(0, 120),
    });
  });
});
