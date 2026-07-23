import { z } from "zod";
import { identifierSchema } from "./primitives";

const shortTextSchema = z.string().trim().min(1).max(240);
const compactTextSchema = z.string().trim().min(1).max(120);
const axisValueSchema = z.union([
  z.string().trim().min(1).max(80),
  z.number().finite(),
]);

const chartPointSchema = z
  .object({
    x: axisValueSchema,
    y: z.number().finite(),
    label: compactTextSchema.optional(),
  })
  .strict();

const chartAnnotationSchema = z
  .object({
    x: axisValueSchema,
    y: z.number().finite().optional(),
    label: compactTextSchema,
  })
  .strict();

function hasRepresentableScale(values: number[]) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding =
    minimum === maximum
      ? Math.max(Math.abs(minimum) * 0.1, 1)
      : (maximum - minimum) * 0.1;
  const start = minimum - padding;
  const end = maximum + padding;

  return (
    Number.isFinite(padding) &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    Number.isFinite(end - start) &&
    start < end
  );
}

export const chartArtifactDataSchema = z
  .object({
    variant: z.enum(["line", "bar", "scatter"]),
    xLabel: compactTextSchema.optional(),
    yLabel: compactTextSchema.optional(),
    series: z
      .array(
        z
          .object({
            name: compactTextSchema,
            points: z.array(chartPointSchema).min(1).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    annotations: z.array(chartAnnotationSchema).max(8).optional(),
  })
  .strict()
  .superRefine(({ annotations = [], series, variant }, context) => {
    const points = series.flatMap(({ points }) => points);

    for (const [index, annotation] of annotations.entries()) {
      if (!points.some((point) => Object.is(point.x, annotation.x))) {
        context.addIssue({
          code: "custom",
          message: "Chart annotations must reference an existing x-value",
          path: ["annotations", index, "x"],
        });
      }
    }

    const numericX = points.every((point) => typeof point.x === "number");
    if (
      numericX &&
      !hasRepresentableScale(points.map((point) => Number(point.x)))
    ) {
      context.addIssue({
        code: "custom",
        message: "Chart x-values must form a representable scale",
        path: ["series"],
      });
    }

    const yValues = [
      ...points.map((point) => point.y),
      ...annotations.flatMap(({ y }) => (y === undefined ? [] : [y])),
    ];
    const yScaleValues = variant === "bar" ? [0, ...yValues] : yValues;
    if (!hasRepresentableScale(yScaleValues)) {
      context.addIssue({
        code: "custom",
        message: "Chart y-values must form a representable scale",
        path: ["series"],
      });
    }
  });

export const comparisonArtifactDataSchema = z
  .object({
    columns: z
      .array(
        z
          .object({
            heading: compactTextSchema,
            summary: shortTextSchema,
            points: z.array(shortTextSchema).max(5),
            emphasis: z.enum(["neutral", "positive", "caution"]).optional(),
          })
          .strict(),
      )
      .min(2)
      .max(4),
  })
  .strict();

export const sequenceArtifactDataSchema = z
  .object({
    steps: z
      .array(
        z
          .object({
            id: identifierSchema,
            title: compactTextSchema,
            content: z.string().trim().min(1).max(2_000),
          })
          .strict(),
      )
      .min(2)
      .max(8),
    activeStepId: identifierSchema,
    reveal: z.enum(["active", "through-active", "all"]),
  })
  .strict()
  .superRefine(({ activeStepId, steps }, context) => {
    const ids = steps.map(({ id }) => id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Sequence step IDs must be unique",
        path: ["steps"],
      });
    }
    if (!ids.includes(activeStepId)) {
      context.addIssue({
        code: "custom",
        message: "Sequence active step must exist",
        path: ["activeStepId"],
      });
    }
  });

const choicesSchema = z
  .array(shortTextSchema)
  .max(6)
  .refine((choices) => choices.length !== 1, {
    message: "Checkpoint choices must be empty or contain two to six choices",
  })
  .optional();

export const checkpointArtifactDataSchema = z
  .object({
    mode: z.enum(["prediction", "retrieval", "classification", "transfer"]),
    prompt: z.string().trim().min(1).max(1_000),
    choices: choicesSchema,
    hint: z.string().trim().min(1).max(1_000).optional(),
    expectedAnswer: z.string().trim().min(1).max(1_000).optional(),
    feedback: z.string().trim().min(1).max(1_000).optional(),
    status: z.enum(["unanswered", "attempted", "correct", "revise"]),
    showHint: z.boolean(),
    showAnswer: z.boolean(),
    showFeedback: z.boolean(),
  })
  .strict();

export type ChartArtifactData = z.infer<typeof chartArtifactDataSchema>;
export type ComparisonArtifactData = z.infer<
  typeof comparisonArtifactDataSchema
>;
export type SequenceArtifactData = z.infer<typeof sequenceArtifactDataSchema>;
export type CheckpointArtifactData = z.infer<
  typeof checkpointArtifactDataSchema
>;
