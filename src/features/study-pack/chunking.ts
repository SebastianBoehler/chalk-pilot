import {
  STUDY_CHUNK_TARGET,
  studyChunkSchema,
  type StudyBlock,
  type StudyChunk,
} from "./schema";

interface ChunkInput {
  packId: string;
  sourceId: string;
  sourceTitle: string;
  blocks: StudyBlock[];
  target?: number;
}

export function chunkStudyBlocks(input: ChunkInput): StudyChunk[] {
  const target = input.target ?? STUDY_CHUNK_TARGET;
  const chunks: StudyChunk[] = [];
  for (const block of input.blocks) {
    for (const text of splitText(block.text, target)) {
      const ordinal = chunks.length;
      chunks.push(
        studyChunkSchema.parse({
          id: `${input.sourceId}-c-${ordinal + 1}`,
          packId: input.packId,
          sourceId: input.sourceId,
          sourceTitle: input.sourceTitle,
          locator: block.locator,
          ordinal,
          text,
        }),
      );
    }
  }
  return chunks;
}

function splitText(raw: string, target: number): string[] {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return [];
  if (text.length <= target) return [text];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const result: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > target) {
      if (current) result.push(current);
      result.push(...splitWords(sentence, target));
      current = "";
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > target) {
      result.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) result.push(current);
  return result;
}

function splitWords(text: string, target: number): string[] {
  const result: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > target && current) {
      result.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) result.push(current);
  return result;
}
