import { z } from "zod";
import {
  canvasStateSchema,
  identifierSchema,
} from "@/features/workspace/schema";

export const canvasArtifactSchema = z.enum([
  "chart",
  "checkpoint",
  "comparison",
  "diagram",
  "example",
  "exercise",
  "explanation",
  "flow",
  "formula",
  "mixed",
  "sequence",
]);

const boardImageSchema = z
  .string()
  .max(8_000_000)
  .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/);

export const canvasJobRequestSchema = z
  .object({
    jobId: identifierSchema,
    goal: z.string().trim().min(1).max(2_000),
    artifact: canvasArtifactSchema,
    boardImage: boardImageSchema.optional(),
    sourceChunkIds: z
      .array(identifierSchema)
      .max(5)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "Study chunk identifiers must be unique.",
      })
      .optional(),
  })
  .strict();

export const canvasDelegationSchema = canvasJobRequestSchema.pick({
  goal: true,
  artifact: true,
  sourceChunkIds: true,
});

export const canvasJobResultSchema = z
  .object({
    jobId: identifierSchema,
    summary: z.string().trim().min(1).max(500),
    canvas: canvasStateSchema,
    metrics: z
      .object({
        provider: z.string().trim().min(1).max(80),
        model: z.string().trim().min(1).max(160),
        queuedAt: z.iso.datetime(),
        startedAt: z.iso.datetime(),
        completedAt: z.iso.datetime(),
        queueMs: z.number().finite().nonnegative(),
        executionMs: z.number().finite().nonnegative(),
        totalMs: z.number().finite().nonnegative(),
      })
      .strict(),
  })
  .strict();

export type CanvasArtifact = z.infer<typeof canvasArtifactSchema>;
export type CanvasJobRequest = z.infer<typeof canvasJobRequestSchema>;
export type CanvasJobResult = z.infer<typeof canvasJobResultSchema>;
export type CanvasDelegationInput = z.infer<typeof canvasDelegationSchema>;
