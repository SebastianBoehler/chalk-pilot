import { join, resolve, sep } from "node:path";
import { identifierSchema } from "./schema";

export function assertIdentifier(value: string): string {
  return identifierSchema.parse(value);
}

export function containedPath(root: string, ...segments: string[]): string {
  const resolvedRoot = resolve(root);
  const candidate = resolve(resolvedRoot, ...segments);
  if (
    candidate !== resolvedRoot &&
    !candidate.startsWith(`${resolvedRoot}${sep}`)
  ) {
    throw new Error("Workspace path escapes its root");
  }
  return candidate;
}

export function getSessionPaths(root: string, sessionId: string) {
  const id = assertIdentifier(sessionId);
  const directory = containedPath(root, "sessions", id);
  return {
    directory,
    record: join(directory, "session.json"),
    transcript: join(directory, "transcript.jsonl"),
    events: join(directory, "events.jsonl"),
    canvasDirectory: join(directory, "canvas"),
    canvasState: join(directory, "canvas", "state.json"),
    sectionsDirectory: join(directory, "canvas", "sections"),
  };
}

export function getRecordingPaths(root: string, sessionId: string) {
  const session = getSessionPaths(root, sessionId);
  const directory = containedPath(session.directory, "recordings");
  return {
    directory,
    manifest: containedPath(directory, "manifest.json"),
    tracksDirectory: containedPath(directory, "tracks"),
    chunksDirectory: containedPath(directory, "chunks"),
    transcript: containedPath(directory, "transcript.json"),
    canvasEvents: containedPath(directory, "canvas-events.json"),
  };
}
