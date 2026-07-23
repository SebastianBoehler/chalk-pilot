// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultRecordingApi } from "./default-repository";

describe("default recording API session validation", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "chalkpilot-recording-default-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true });
  });

  it("creates a recording for a validated matching session record", async () => {
    await writeSession(root, {
      id: "session-1",
      status: "active",
      createdAt: "2026-07-23T08:00:00.000Z",
      completedAt: null,
    });

    const response =
      await createDefaultRecordingApi(root).createRecording("session-1");

    expect(response.status).toBe(201);
  });

  it("returns 404 when the session record is missing", async () => {
    const response =
      await createDefaultRecordingApi(root).createRecording("missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Session not found." });
  });

  it("maps a malformed persisted session record to a server error", async () => {
    await writeSession(root, {});

    const response =
      await createDefaultRecordingApi(root).createRecording("session-1");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "The recording operation failed.",
    });
  });

  it("maps a mismatched persisted session id to a server error", async () => {
    await writeSession(root, {
      id: "another-session",
      status: "active",
      createdAt: "2026-07-23T08:00:00.000Z",
      completedAt: null,
    });

    const response =
      await createDefaultRecordingApi(root).createRecording("session-1");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "The recording operation failed.",
    });
  });
});

async function writeSession(root: string, record: unknown) {
  const directory = join(root, "sessions/session-1");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "session.json"), JSON.stringify(record));
}
