import {
  hasSectionContent,
  type CanvasSection,
  type CanvasState,
} from "@/features/workspace/schema";

const maxSections = 12;
const maxTitle = 120;
const maxText = 1_200;
const maxUrl = 2_000;
const maxChartPoints = 16;
const maxAnnotations = 4;
const maxComparisonPoints = 3;
const maxSequenceContent = 400;
const maxCheckpointText = 500;

type WithoutTimestamps<T> = T extends CanvasSection
  ? Omit<T, "createdAt" | "updatedAt">
  : never;

export interface CanvasSnapshot {
  focusId: string | null;
  sections: WithoutTimestamps<CanvasSection>[];
}

export function projectCanvasSnapshot(canvas: CanvasState): CanvasSnapshot {
  return {
    focusId: canvas.focusId,
    sections: canvas.order
      .slice(-maxSections)
      .map((id) => projectSection(canvas.sections[id])),
  };
}

function projectSection(
  section: CanvasSection,
): WithoutTimestamps<CanvasSection> {
  const base = {
    id: section.id,
    kind: section.kind,
    title: clip(section.title, maxTitle),
  };
  if (hasSectionContent(section)) {
    return {
      ...base,
      content: clip(
        section.content,
        section.kind === "image" || section.kind === "youtube"
          ? maxUrl
          : maxText,
      ),
    } as WithoutTimestamps<CanvasSection>;
  }

  switch (section.kind) {
    case "chart":
      return {
        ...base,
        kind: "chart",
        data: {
          variant: section.data.variant,
          xLabel: optionalClip(section.data.xLabel, maxTitle),
          yLabel: optionalClip(section.data.yLabel, maxTitle),
          series: section.data.series.map((series) => ({
            name: clip(series.name, maxTitle),
            points: series.points.slice(0, maxChartPoints).map((point) => ({
              x:
                typeof point.x === "string" ? clip(point.x, maxTitle) : point.x,
              y: point.y,
              label: optionalClip(point.label, maxTitle),
            })),
          })),
          annotations: section.data.annotations
            ?.slice(0, maxAnnotations)
            .map((annotation) => ({
              x:
                typeof annotation.x === "string"
                  ? clip(annotation.x, maxTitle)
                  : annotation.x,
              y: annotation.y,
              label: clip(annotation.label, maxTitle),
            })),
        },
      };
    case "comparison":
      return {
        ...base,
        kind: "comparison",
        data: {
          columns: section.data.columns.map((column) => ({
            heading: clip(column.heading, maxTitle),
            summary: clip(column.summary, maxText),
            points: column.points
              .slice(0, maxComparisonPoints)
              .map((point) => clip(point, maxText)),
            emphasis: column.emphasis,
          })),
        },
      };
    case "sequence":
      return {
        ...base,
        kind: "sequence",
        data: {
          steps: section.data.steps.map((step) => ({
            id: step.id,
            title: clip(step.title, maxTitle),
            content: clip(step.content, maxSequenceContent),
          })),
          activeStepId: section.data.activeStepId,
          reveal: section.data.reveal,
        },
      };
    case "checkpoint":
      return {
        ...base,
        kind: "checkpoint",
        data: {
          mode: section.data.mode,
          prompt: clip(section.data.prompt, maxCheckpointText),
          choices: section.data.choices?.map((choice) =>
            clip(choice, maxCheckpointText),
          ),
          hint: optionalClip(section.data.hint, maxCheckpointText),
          expectedAnswer: optionalClip(
            section.data.expectedAnswer,
            maxCheckpointText,
          ),
          feedback: optionalClip(section.data.feedback, maxCheckpointText),
          status: section.data.status,
          showHint: section.data.showHint,
          showAnswer: section.data.showAnswer,
          showFeedback: section.data.showFeedback,
        },
      };
  }
}

function clip(value: string, length: number) {
  return value.slice(0, length);
}

function optionalClip(value: string | undefined, length: number) {
  return value === undefined ? undefined : clip(value, length);
}
