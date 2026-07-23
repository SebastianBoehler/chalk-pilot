import { access } from "node:fs/promises";
import { join } from "node:path";
import { getSessionPaths } from "../workspace/paths";
import { createRecordingApi } from "./api";
import { createRecordingRepository } from "./repository";

export const recordingRoot = join(process.cwd(), ".chalkpilot");
export const recordingRepository = createRecordingRepository(recordingRoot);

export const recordingApi = createRecordingApi({
  repository: recordingRepository,
  rootDirectory: recordingRoot,
  async sessionExists(sessionId) {
    try {
      await access(getSessionPaths(recordingRoot, sessionId).record);
      return true;
    } catch (error) {
      if (isMissingFile(error)) return false;
      throw error;
    }
  },
});

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
