import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSessionPaths } from "../workspace/paths";
import { sessionRecordSchema } from "../workspace/schema";
import { createRecordingApi } from "./api";
import {
  createRecordingRepository,
  type RecordingRepository,
} from "./repository";

export const recordingRoot = join(process.cwd(), ".chalkpilot");
export const recordingRepository = createRecordingRepository(recordingRoot);
export const recordingApi = configuredApi(recordingRoot, recordingRepository);

export function createDefaultRecordingApi(rootDirectory: string) {
  return configuredApi(rootDirectory, createRecordingRepository(rootDirectory));
}

function configuredApi(rootDirectory: string, repository: RecordingRepository) {
  return createRecordingApi({
    repository,
    rootDirectory,
    async sessionExists(sessionId) {
      try {
        const record = sessionRecordSchema.parse(
          JSON.parse(
            await readFile(
              getSessionPaths(rootDirectory, sessionId).record,
              "utf8",
            ),
          ),
        );
        if (record.id !== sessionId) {
          throw new Error("Session record identifier does not match its path");
        }
        return true;
      } catch (error) {
        if (isMissingFile(error)) return false;
        throw error;
      }
    },
  });
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
