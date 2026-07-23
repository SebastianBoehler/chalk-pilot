import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRecordingApi, type RecordingApi } from "./api";
import {
  createRecordingRepository,
  type RecordingRepository,
} from "./repository";

export interface RecordingApiFixture {
  api: RecordingApi;
  repository: RecordingRepository;
  root: string;
  dispose(): Promise<void>;
}

export async function createApiFixture(
  knownSessions = ["session-1"],
): Promise<RecordingApiFixture> {
  const root = await mkdtemp(join(tmpdir(), "chalkpilot-recording-api-"));
  for (const sessionId of knownSessions) {
    const directory = join(root, "sessions", sessionId);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "session.json"), "{}");
  }
  const known = new Set(knownSessions);
  const repository = createRecordingRepository(root);
  return {
    root,
    repository,
    api: createRecordingApi({
      repository,
      rootDirectory: root,
      sessionExists: async (sessionId) => known.has(sessionId),
    }),
    dispose: () => rm(root, { recursive: true }),
  };
}

export function chunkRequest(
  bytes: Uint8Array,
  headers: Record<string, string> = {},
) {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Request("http://localhost/chunk", {
    method: "PUT",
    body,
    headers: {
      "content-type": "video/webm;codecs=vp9",
      "x-chalkpilot-offset-ms": "0",
      "x-chalkpilot-duration-ms": "2000",
      ...headers,
    },
  });
}

export function jsonRequest(body: unknown) {
  return new Request("http://localhost/recording", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
