import { z } from "zod";
import { identifierSchema } from "@/features/workspace/primitives";

export const canvasTargetIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)?$/);

export const canvasNavigationSchema = z
  .object({
    requestId: identifierSchema,
    targetId: canvasTargetIdSchema,
    kind: z.enum(["focus", "highlight"]),
    text: z.string().trim().min(1).max(240).optional(),
    issuedAt: z.iso.datetime(),
  })
  .strict();

export type CanvasNavigation = z.infer<typeof canvasNavigationSchema>;

export function nestedTarget(sectionId: string, nestedId: string) {
  return `${sectionId}:${nestedId}`;
}

export function createCanvasNavigation(
  input: { targetId: string; kind: "focus" | "highlight"; text?: string },
  dependencies: {
    createId?: () => string;
    now?: () => Date;
  } = {},
): CanvasNavigation {
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());

  return canvasNavigationSchema.parse({
    requestId: createId(),
    ...input,
    issuedAt: now().toISOString(),
  });
}
