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
  })
  .strict();

export const canvasJobResultSchema = z
  .object({
    jobId: identifierSchema,
    summary: z.string().trim().min(1).max(500),
    canvas: canvasStateSchema,
  })
  .strict();

export type CanvasArtifact = z.infer<typeof canvasArtifactSchema>;
export type CanvasJobRequest = z.infer<typeof canvasJobRequestSchema>;
export type CanvasJobResult = z.infer<typeof canvasJobResultSchema>;
export type CanvasDelegationInput = Pick<CanvasJobRequest, "goal" | "artifact">;
