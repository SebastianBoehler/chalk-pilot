// @vitest-environment node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceRepository } from "@/features/workspace/repository";
import { createStudyPackRepository } from "@/features/study-pack/repository";
import { createCanvasWorkerApi } from "./api";
import {
  CanvasAgentExecutionError,
  createCanvasWorkerService,
} from "./service";

describe("canvas worker API", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "chalkpilot-canvas-api-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true });
  });

  it("runs an injected canvas agent and returns the persisted canvas", async () => {
    const repository = createWorkspaceRepository(root);
    const session = await repository.createSession();
    const service = createCanvasWorkerService({
      repository,
      providerIdentity: { provider: "test", model: "mock-fast-model" },
      runAgent: async ({ actions }) => {
        await actions.upsertSection({
          id: "attention-flow",
          kind: "mermaid",
          title: "Attention flow",
          content: "flowchart LR\nTokens --> Attention --> Context",
        });
        await actions.focusSection({ sectionId: "attention-flow" });
        return "Added the attention flow.";
      },
    });
    const api = createCanvasWorkerApi(service);

    const response = await api.run(
      session.id,
      jsonRequest({
        jobId: "job-1",
        goal: "Show how attention turns token vectors into context.",
        artifact: "diagram",
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      jobId: "job-1",
      summary: "Added the attention flow.",
      metrics: {
        provider: "test",
        model: "mock-fast-model",
        queueMs: expect.any(Number),
        executionMs: expect.any(Number),
        totalMs: expect.any(Number),
      },
      canvas: {
        focusId: "attention-flow",
        order: ["attention-flow"],
      },
    });
    const events = (
      await readFile(join(root, "sessions", session.id, "events.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as unknown);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "canvas_job",
        metadata: expect.objectContaining({
          jobId: "job-1",
          status: "complete",
          provider: "test",
          model: "mock-fast-model",
          totalMs: expect.any(Number),
        }),
      }),
    );
  });

  it("returns bounded errors for invalid input and missing sessions", async () => {
    const repository = createWorkspaceRepository(root);
    const service = createCanvasWorkerService({
      repository,
      runAgent: async () => "unused",
    });
    const api = createCanvasWorkerApi(service);

    const invalid = await api.run(
      "missing-session",
      jsonRequest({ jobId: "../unsafe" }),
    );
    const missing = await api.run(
      "missing-session",
      jsonRequest({
        jobId: "job-2",
        goal: "Add context.",
        artifact: "explanation",
      }),
    );

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
  });

  it("keeps provider failures separate from voice-session errors", async () => {
    const repository = createWorkspaceRepository(root);
    const session = await repository.createSession();
    const service = createCanvasWorkerService({
      repository,
      runAgent: async () => {
        throw new CanvasAgentExecutionError("Canvas provider unavailable.");
      },
    });
    const response = await createCanvasWorkerApi(service).run(
      session.id,
      jsonRequest({
        jobId: "job-3",
        goal: "Create a comparison.",
        artifact: "comparison",
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Canvas provider unavailable.",
    });
  });

  it("resolves selected-pack evidence before allowing cited canvas work", async () => {
    const repository = createWorkspaceRepository(root);
    const studyPacks = createStudyPackRepository(root);
    const pack = await studyPacks.createPack("Probabilistic ML");
    await studyPacks.uploadSource(pack.id, {
      fileName: "lecture.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode(
        "Reverse KL can prefer one mode in a multimodal target.",
      ),
    });
    const [chunk] = await studyPacks.readChunks(pack.id);
    const session = await repository.createSession({ studyPackId: pack.id });
    const service = createCanvasWorkerService({
      repository,
      studyPacks,
      runAgent: async ({ actions, evidence }) => {
        expect(evidence).toEqual([
          expect.objectContaining({
            id: chunk.id,
            sourceTitle: "lecture",
            locator: "Paragraph 1",
          }),
        ]);
        await actions.upsertSection({
          id: "reverse-kl",
          kind: "markdown",
          title: "Reverse KL",
          content: "Reverse KL can prefer one mode.",
          citations: [
            {
              chunkId: chunk.id,
              sourceTitle: chunk.sourceTitle,
              locator: chunk.locator,
            },
          ],
        });
        await actions.focusSection({ sectionId: "reverse-kl" });
        return "Added a grounded explanation.";
      },
    });
    const response = await createCanvasWorkerApi(service).run(
      session.id,
      jsonRequest({
        jobId: "job-grounded",
        goal: "Explain reverse KL from the notes.",
        artifact: "explanation",
        sourceChunkIds: [chunk.id],
      }),
    );

    expect(response.status).toBe(200);
    expect(
      (await repository.readCanvas(session.id)).sections["reverse-kl"],
    ).toMatchObject({
      citations: [{ chunkId: chunk.id, locator: "Paragraph 1" }],
    });
  });

  it("rejects a study chunk outside the selected pack", async () => {
    const repository = createWorkspaceRepository(root);
    const studyPacks = createStudyPackRepository(root);
    const selected = await studyPacks.createPack("Selected");
    const other = await studyPacks.createPack("Other");
    await studyPacks.uploadSource(other.id, {
      fileName: "other.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode("Other course material."),
    });
    const [otherChunk] = await studyPacks.readChunks(other.id);
    const session = await repository.createSession({
      studyPackId: selected.id,
    });
    const response = await createCanvasWorkerApi(
      createCanvasWorkerService({
        repository,
        studyPacks,
        runAgent: async () => "must not run",
      }),
    ).run(
      session.id,
      jsonRequest({
        jobId: "job-cross-pack",
        goal: "Use unrelated material.",
        artifact: "explanation",
        sourceChunkIds: [otherChunk.id],
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "A requested study passage is unavailable.",
    });
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
