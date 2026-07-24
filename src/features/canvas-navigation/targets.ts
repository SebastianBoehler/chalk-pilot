import type { CanvasSection, CanvasState } from "@/features/workspace/schema";
import { nestedTarget } from "./schema";

export interface CanvasTarget {
  id: string;
  sectionId: string;
  label: string;
  text: string;
}

export function listCanvasTargets(canvas: CanvasState): CanvasTarget[] {
  return canvas.order.flatMap((sectionId) => {
    const section = canvas.sections[sectionId];
    return section ? targetsForSection(section) : [];
  });
}

export function resolveCanvasTarget(
  canvas: CanvasState,
  targetId: string,
): CanvasTarget {
  const target = listCanvasTargets(canvas).find(({ id }) => id === targetId);
  if (!target) throw new Error("Canvas target is unavailable.");
  return target;
}

function targetsForSection(section: CanvasSection): CanvasTarget[] {
  const target = (id: string, label: string, text: string): CanvasTarget => ({
    id,
    sectionId: section.id,
    label,
    text,
  });
  const sectionTarget = target(section.id, section.title, sectionText(section));

  switch (section.kind) {
    case "flow":
      return [
        sectionTarget,
        ...section.data.nodes.map((node) =>
          target(
            nestedTarget(section.id, node.id),
            node.title,
            joinText(node.title, node.detail),
          ),
        ),
      ];
    case "sequence":
      return [
        sectionTarget,
        ...section.data.steps.map((step, index) =>
          target(
            nestedTarget(section.id, step.id),
            step.title,
            sequenceStepText(section, index),
          ),
        ),
      ];
    case "checkpoint":
      return [
        sectionTarget,
        target(
          nestedTarget(section.id, "prompt"),
          "Prompt",
          section.data.prompt,
        ),
      ];
    case "chart":
      return [
        sectionTarget,
        ...(section.data.annotations ?? []).flatMap((annotation) =>
          annotation.id
            ? [
                target(
                  nestedTarget(section.id, annotation.id),
                  annotation.label,
                  annotation.label,
                ),
              ]
            : [],
        ),
      ];
    default:
      return [sectionTarget];
  }
}

function sectionText(section: CanvasSection) {
  if ("content" in section) return joinText(section.title, section.content);

  switch (section.kind) {
    case "chart":
      return joinText(
        section.title,
        section.data.xLabel,
        section.data.yLabel,
        ...section.data.series.flatMap((series) => [
          series.name,
          ...series.points.flatMap(({ label }) => (label ? [label] : [])),
        ]),
        ...(section.data.annotations ?? []).map(({ label }) => label),
      );
    case "comparison":
      return joinText(
        section.title,
        ...section.data.columns.flatMap((column) => [
          column.heading,
          column.summary,
          ...column.points,
        ]),
      );
    case "flow":
      return joinText(
        section.title,
        ...section.data.nodes.flatMap(({ title, detail }) => [title, detail]),
        ...section.data.edges.flatMap(({ label }) => (label ? [label] : [])),
      );
    case "sequence":
      return joinText(
        section.title,
        ...section.data.steps.flatMap((step, index) => [
          step.title,
          ...(sequenceStepIsRevealed(section, index) ? [step.content] : []),
        ]),
      );
    case "checkpoint":
      return joinText(
        section.title,
        "Checkpoint",
        section.data.prompt,
        ...(section.data.choices ?? []),
        ...(section.data.showHint && section.data.hint
          ? [section.data.hint]
          : []),
        ...(section.data.showAnswer && section.data.expectedAnswer
          ? [section.data.expectedAnswer]
          : []),
        ...(section.data.showFeedback && section.data.feedback
          ? [section.data.feedback]
          : []),
      );
  }
}

function sequenceStepText(
  section: Extract<CanvasSection, { kind: "sequence" }>,
  index: number,
) {
  const step = section.data.steps[index];
  if (!step) return "";
  return joinText(
    step.title,
    ...(sequenceStepIsRevealed(section, index) ? [step.content] : []),
  );
}

function sequenceStepIsRevealed(
  section: Extract<CanvasSection, { kind: "sequence" }>,
  index: number,
) {
  const activeIndex = section.data.steps.findIndex(
    ({ id }) => id === section.data.activeStepId,
  );
  return (
    section.data.reveal === "all" ||
    (section.data.reveal === "through-active" && index <= activeIndex) ||
    (section.data.reveal === "active" && index === activeIndex)
  );
}

function joinText(...values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join("\n");
}
