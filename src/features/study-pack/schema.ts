import { z } from "zod";
import { identifierSchema } from "@/features/workspace/schema";

export const MAX_STUDY_SOURCES = 20;
export const MAX_STUDY_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_PAGES = 500;
export const STUDY_CHUNK_TARGET = 1_600;

export const studySourceFormatSchema = z.enum(["pdf", "markdown", "text"]);

export const studyChunkSchema = z
  .object({
    id: identifierSchema,
    packId: identifierSchema,
    sourceId: identifierSchema,
    sourceTitle: z.string().trim().min(1).max(240),
    locator: z.string().trim().min(1).max(240),
    ordinal: z.number().int().nonnegative(),
    text: z.string().trim().min(1).max(4_000),
  })
  .strict();

export const studySourceSchema = z
  .object({
    id: identifierSchema,
    packId: identifierSchema,
    title: z.string().trim().min(1).max(240),
    fileName: z.string().trim().min(1).max(240),
    format: studySourceFormatSchema,
    mimeType: z.string().trim().min(1).max(120),
    sizeBytes: z.number().int().nonnegative(),
    chunkCount: z.number().int().nonnegative(),
    locators: z.array(z.string().trim().min(1).max(240)).max(500),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const studyPackSchema = z
  .object({
    id: identifierSchema,
    title: z.string().trim().min(1).max(120),
    sources: z.array(studySourceSchema).max(MAX_STUDY_SOURCES),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export const studyPackSummarySchema = studyPackSchema.pick({
  id: true,
  title: true,
  sources: true,
  createdAt: true,
  updatedAt: true,
});

export const studyPackOutlineSchema = studyPackSchema.pick({
  id: true,
  title: true,
  sources: true,
});

export const studySearchRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    limit: z.number().int().min(1).max(5).default(5),
  })
  .strict();

export const studySearchHitSchema = studyChunkSchema.extend({
  score: z.number().finite().nonnegative(),
});

export const studyPassageSchema = z
  .object({
    current: studyChunkSchema,
    previous: studyChunkSchema.nullable(),
    next: studyChunkSchema.nullable(),
  })
  .strict();

export type StudyChunk = z.infer<typeof studyChunkSchema>;
export type StudySource = z.infer<typeof studySourceSchema>;
export type StudyPack = z.infer<typeof studyPackSchema>;
export type StudyPackOutline = z.infer<typeof studyPackOutlineSchema>;
export type StudySearchHit = z.infer<typeof studySearchHitSchema>;
export type StudyPassage = z.infer<typeof studyPassageSchema>;
export type StudySourceFormat = z.infer<typeof studySourceFormatSchema>;

export interface StudyUpload {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface ParsedStudySource {
  format: StudySourceFormat;
  blocks: StudyBlock[];
}

export interface StudyBlock {
  locator: string;
  text: string;
}
