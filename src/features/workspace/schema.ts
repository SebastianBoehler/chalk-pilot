import { z } from "zod";

export const identifierSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "Invalid identifier");

const titleSchema = z.string().trim().min(1).max(120);
const textContentSchema = z.string().trim().min(1).max(20_000);
const httpUrlSchema = z
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "Media URL must use HTTP or HTTPS",
  });
const youtubeUrlSchema = httpUrlSchema.refine(
  (value) => {
    const hostname = new URL(value).hostname.replace(/^www\./, "");
    return ["youtube.com", "youtu.be", "youtube-nocookie.com"].includes(
      hostname,
    );
  },
  { message: "YouTube URL must use a supported YouTube host" },
);

const sectionBase = z.object({
  id: identifierSchema,
  title: titleSchema,
});

export const canvasSectionInputSchema = z.discriminatedUnion("kind", [
  sectionBase.extend({
    kind: z.enum(["markdown", "math", "mermaid"]),
    content: textContentSchema,
  }),
  sectionBase.extend({
    kind: z.literal("image"),
    content: httpUrlSchema,
  }),
  sectionBase.extend({
    kind: z.literal("youtube"),
    content: youtubeUrlSchema,
  }),
]);

export const canvasSectionSchema = canvasSectionInputSchema.and(
  z.object({
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
);

export const canvasSectionMetadataSchema = z.object({
  id: identifierSchema,
  kind: z.enum(["markdown", "math", "mermaid", "image", "youtube"]),
  title: titleSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const storedCanvasStateSchema = z.object({
  version: z.literal(1),
  focusId: identifierSchema.nullable(),
  order: z.array(identifierSchema),
  sections: z.record(identifierSchema, canvasSectionMetadataSchema),
});

export const canvasStateSchema = z.object({
  version: z.literal(1),
  focusId: identifierSchema.nullable(),
  order: z.array(identifierSchema),
  sections: z.record(identifierSchema, canvasSectionSchema),
});

export const sessionRecordSchema = z.object({
  id: identifierSchema,
  status: z.enum(["active", "complete"]),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});

export const transcriptTurnSchema = z
  .object({
    id: identifierSchema,
    role: z.enum(["user", "assistant"]),
    text: z.string().trim().min(1).max(10_000),
    createdAt: z.iso.datetime(),
  })
  .strict();

const eventValueSchema = z.union([
  z.string().max(2_000),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const learningEventSchema = z
  .object({
    id: identifierSchema,
    type: z.enum([
      "board_inspection",
      "canvas_mutation",
      "hint",
      "independent_attempt",
      "realtime_connected",
      "realtime_disconnected",
      "session_ended",
      "session_started",
    ]),
    createdAt: z.iso.datetime(),
    metadata: z.record(z.string().max(80), eventValueSchema).optional(),
  })
  .strict();

export const learnerMemoryInputSchema = z
  .object({
    claim: z.string().trim().min(1).max(500),
    evidence: identifierSchema,
    scope: z.string().trim().min(1).max(120),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type CanvasSectionInput = z.infer<typeof canvasSectionInputSchema>;
export type CanvasSection = z.infer<typeof canvasSectionSchema>;
export type CanvasState = z.infer<typeof canvasStateSchema>;
export type SessionRecord = z.infer<typeof sessionRecordSchema>;
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;
export type LearningEvent = z.infer<typeof learningEventSchema>;
export type LearnerMemoryInput = z.infer<typeof learnerMemoryInputSchema>;

export interface LearnerMemoryEntry extends LearnerMemoryInput {
  id: string;
  createdAt: string;
}

export interface LearnerMemory {
  version: 1;
  entries: LearnerMemoryEntry[];
}
