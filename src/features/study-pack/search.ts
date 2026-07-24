import MiniSearch from "minisearch";
import {
  studyPassageSchema,
  studySearchHitSchema,
  type StudyChunk,
  type StudyPassage,
  type StudySearchHit,
} from "./schema";

export function searchStudyChunks(
  chunks: StudyChunk[],
  query: string,
  limit = 5,
): StudySearchHit[] {
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const index = new MiniSearch<StudyChunk>({
    idField: "id",
    fields: ["text", "sourceTitle", "locator"],
    storeFields: [],
    searchOptions: {
      boost: { sourceTitle: 1.5, locator: 1.25 },
      prefix: true,
      fuzzy: 0.15,
    },
  });
  index.addAll(chunks);
  return index
    .search(query)
    .slice(0, Math.max(1, Math.min(5, limit)))
    .flatMap((result) => {
      const chunk = byId.get(String(result.id));
      return chunk
        ? [studySearchHitSchema.parse({ ...chunk, score: result.score })]
        : [];
    });
}

export function readStudyPassage(
  chunks: StudyChunk[],
  chunkId: string,
): StudyPassage | undefined {
  const index = chunks.findIndex((chunk) => chunk.id === chunkId);
  if (index < 0) return undefined;
  const current = chunks[index];
  return studyPassageSchema.parse({
    current,
    previous:
      chunks[index - 1]?.sourceId === current.sourceId
        ? chunks[index - 1]
        : null,
    next:
      chunks[index + 1]?.sourceId === current.sourceId
        ? chunks[index + 1]
        : null,
  });
}
