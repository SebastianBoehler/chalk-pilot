import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { chunkStudyBlocks } from "./chunking";
import { parseStudySource } from "./parsers";
import { studyPackPaths, studyPacksRoot, studySourcePaths } from "./paths";
import { readStudyPassage, searchStudyChunks } from "./search";
import {
  MAX_STUDY_FILE_BYTES,
  MAX_STUDY_SOURCES,
  studyChunkSchema,
  studyPackOutlineSchema,
  studyPackSchema,
  studySourceSchema,
  type StudyChunk,
  type StudyPack,
  type StudyUpload,
} from "./schema";

export class StudyPackNotFoundError extends Error {}
export class StudyPackLimitError extends Error {}

export function createStudyPackRepository(rootDirectory: string) {
  const root = resolve(rootDirectory);
  const queues = new Map<string, Promise<unknown>>();

  async function createPack(title: string): Promise<StudyPack> {
    const now = new Date().toISOString();
    const pack = studyPackSchema.parse({
      id: randomUUID(),
      title,
      sources: [],
      createdAt: now,
      updatedAt: now,
    });
    const paths = studyPackPaths(root, pack.id);
    await mkdir(paths.sources, { recursive: true });
    await atomicWrite(paths.manifest, pack);
    return pack;
  }

  async function listPacks(): Promise<StudyPack[]> {
    try {
      const entries = await readdir(studyPacksRoot(root), {
        withFileTypes: true,
      });
      const packs = await Promise.all(
        entries
          .filter(
            (entry) => entry.isDirectory() && !entry.name.endsWith(".tmp"),
          )
          .map((entry) => readPack(entry.name)),
      );
      return packs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }

  async function readPack(packId: string): Promise<StudyPack> {
    try {
      return studyPackSchema.parse(
        JSON.parse(
          await readFile(studyPackPaths(root, packId).manifest, "utf8"),
        ),
      );
    } catch (error) {
      if (isMissing(error))
        throw new StudyPackNotFoundError(`Unknown study pack: ${packId}`);
      throw error;
    }
  }

  async function uploadSource(packId: string, upload: StudyUpload) {
    if (upload.bytes.byteLength > MAX_STUDY_FILE_BYTES) {
      throw new StudyPackLimitError("Files may be at most 20 MiB.");
    }
    return queue(packId, async () => {
      const pack = await readPack(packId);
      if (pack.sources.length >= MAX_STUDY_SOURCES) {
        throw new StudyPackLimitError(
          `A study pack may contain at most ${MAX_STUDY_SOURCES} sources.`,
        );
      }
      const sourceId = randomUUID();
      const paths = studySourcePaths(root, packId, sourceId, upload.fileName);
      const temporary = `${paths.directory}.tmp`;
      try {
        const parsed = await parseStudySource(upload);
        const title = sourceTitle(upload.fileName);
        const chunks = chunkStudyBlocks({
          packId,
          sourceId,
          sourceTitle: title,
          blocks: parsed.blocks,
        });
        if (!chunks.length) throw new Error("The source produced no text.");
        const source = studySourceSchema.parse({
          id: sourceId,
          packId,
          title,
          fileName: basename(upload.fileName),
          format: parsed.format,
          mimeType: upload.mimeType,
          sizeBytes: upload.bytes.byteLength,
          chunkCount: chunks.length,
          locators: [...new Set(chunks.map((chunk) => chunk.locator))],
          createdAt: new Date().toISOString(),
        });
        await mkdir(temporary, { recursive: true });
        await Promise.all([
          writeFile(`${temporary}/source.json`, json(source), "utf8"),
          writeFile(
            `${temporary}/chunks.jsonl`,
            `${chunks.map((chunk) => JSON.stringify(chunk)).join("\n")}\n`,
            "utf8",
          ),
          writeFile(
            `${temporary}/${paths.original.split("/").at(-1)}`,
            upload.bytes,
          ),
        ]);
        await rename(temporary, paths.directory);
        const next = studyPackSchema.parse({
          ...pack,
          sources: [...pack.sources, source],
          updatedAt: new Date().toISOString(),
        });
        await atomicWrite(studyPackPaths(root, packId).manifest, next);
        return { pack: next, source };
      } catch (error) {
        await rm(temporary, { recursive: true, force: true });
        throw error;
      }
    });
  }

  async function readChunks(packId: string): Promise<StudyChunk[]> {
    const pack = await readPack(packId);
    const chunks = await Promise.all(
      pack.sources.map(async (source) => {
        const path = studySourcePaths(
          root,
          packId,
          source.id,
          source.fileName,
        ).chunks;
        return (await readFile(path, "utf8"))
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => studyChunkSchema.parse(JSON.parse(line)));
      }),
    );
    return chunks.flat();
  }

  async function outline(packId: string) {
    return studyPackOutlineSchema.parse(await readPack(packId));
  }

  async function search(packId: string, query: string, limit = 5) {
    return searchStudyChunks(await readChunks(packId), query, limit);
  }

  async function passage(packId: string, chunkId: string) {
    return readStudyPassage(await readChunks(packId), chunkId);
  }

  return {
    createPack,
    listPacks,
    readPack,
    uploadSource,
    readChunks,
    outline,
    search,
    passage,
  };

  async function queue<T>(key: string, operation: () => Promise<T>) {
    const previous = queues.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    queues.set(key, current);
    try {
      return await current;
    } finally {
      if (queues.get(key) === current) queues.delete(key);
    }
  }
}

export type StudyPackRepository = ReturnType<typeof createStudyPackRepository>;

async function atomicWrite(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, json(value), "utf8");
  await rename(temporary, path);
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sourceTitle(fileName: string) {
  return basename(fileName).replace(/\.(pdf|md|markdown|txt)$/i, "");
}

function isMissing(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
