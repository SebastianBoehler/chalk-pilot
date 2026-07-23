// @vitest-environment node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceRepository } from "./repository";

describe("WorkspaceRepository", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "chalkpilot-workspace-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true });
  });

  it("creates a session and persists an ordered canvas section", async () => {
    const repository = createWorkspaceRepository(root);
    const session = await repository.createSession();

    await repository.appendSection(session.id, {
      id: "derivative-hint",
      kind: "markdown",
      title: "Try this",
      content: "Differentiate the outer function first.",
    });

    const canvas = await repository.readCanvas(session.id);
    expect(canvas.order).toEqual(["derivative-hint"]);
    expect(canvas.sections["derivative-hint"]).toMatchObject({
      title: "Try this",
      content: "Differentiate the outer function first.",
    });
  });

  it("rejects duplicate and unsafe identifiers", async () => {
    const repository = createWorkspaceRepository(root);
    const session = await repository.createSession();
    const section = {
      id: "safe-section",
      kind: "markdown" as const,
      title: "Safe",
      content: "Content",
    };

    await repository.appendSection(session.id, section);

    await expect(repository.appendSection(session.id, section)).rejects.toThrow(
      "already exists",
    );
    await expect(repository.readCanvas("../other-session")).rejects.toThrow(
      "Invalid identifier",
    );
  });

  it("rejects unsafe media URLs", async () => {
    const repository = createWorkspaceRepository(root);
    const session = await repository.createSession();

    await expect(
      repository.appendSection(session.id, {
        id: "unsafe-video",
        kind: "youtube",
        title: "Video",
        content: "https://example.com/watch?v=not-youtube",
      }),
    ).rejects.toThrow("YouTube");
  });

  it("serializes concurrent canvas writes", async () => {
    const repository = createWorkspaceRepository(root);
    const session = await repository.createSession();

    await Promise.all([
      repository.appendSection(session.id, {
        id: "first",
        kind: "math",
        title: "First",
        content: "x^2",
      }),
      repository.appendSection(session.id, {
        id: "second",
        kind: "mermaid",
        title: "Second",
        content: "graph LR; A-->B",
      }),
    ]);

    expect((await repository.readCanvas(session.id)).order).toEqual([
      "first",
      "second",
    ]);
  });

  it("writes bounded transcript and learning evidence records", async () => {
    const repository = createWorkspaceRepository(root);
    const session = await repository.createSession();

    await repository.appendTranscript(session.id, {
      id: "turn-1",
      role: "user",
      text: "I differentiated the outside first.",
      createdAt: "2026-07-23T10:00:00.000Z",
    });
    await repository.appendEvent(session.id, {
      id: "event-1",
      type: "independent_attempt",
      createdAt: "2026-07-23T10:00:01.000Z",
      metadata: { boardAttached: true },
    });

    const transcript = await readFile(
      join(root, "sessions", session.id, "transcript.jsonl"),
      "utf8",
    );
    expect(transcript).toContain("differentiated");
    expect(transcript).not.toContain("image");

    await expect(
      repository.appendEvent(session.id, {
        id: "event-2",
        type: "board_inspection",
        createdAt: "2026-07-23T10:00:02.000Z",
        image: "data:image/jpeg;base64,secret",
      }),
    ).rejects.toThrow();
  });

  it("persists evidence-linked learner memory", async () => {
    const repository = createWorkspaceRepository(root);

    const memory = await repository.rememberLearner({
      claim: "Benefits from a comparison before a formula.",
      evidence: "turn-1",
      scope: "calculus",
      confidence: 0.8,
    });

    expect(memory.entries).toHaveLength(1);
    expect(memory.entries[0]?.claim).toContain("comparison");
    expect(await readFile(join(root, "learner.md"), "utf8")).toContain(
      "turn-1",
    );
  });
});
