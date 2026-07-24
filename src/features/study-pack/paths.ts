import { extname, join } from "node:path";
import { containedPath } from "@/features/workspace/paths";
import { identifierSchema } from "@/features/workspace/schema";

export function studyPacksRoot(root: string) {
  return containedPath(root, "study-packs");
}

export function studyPackPaths(root: string, rawPackId: string) {
  const packId = identifierSchema.parse(rawPackId);
  const directory = containedPath(studyPacksRoot(root), packId);
  return {
    directory,
    manifest: join(directory, "pack.json"),
    sources: join(directory, "sources"),
  };
}

export function studySourcePaths(
  root: string,
  rawPackId: string,
  rawSourceId: string,
  fileName = "source.txt",
) {
  const sourceId = identifierSchema.parse(rawSourceId);
  const pack = studyPackPaths(root, rawPackId);
  const directory = containedPath(pack.sources, sourceId);
  const extension = safeExtension(fileName);
  return {
    directory,
    metadata: join(directory, "source.json"),
    chunks: join(directory, "chunks.jsonl"),
    original: join(directory, `original${extension}`),
  };
}

function safeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  return [".pdf", ".md", ".markdown", ".txt"].includes(extension)
    ? extension
    : ".txt";
}
