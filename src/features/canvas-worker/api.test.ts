// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceRepository } from "@/features/workspace/repository";
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
      canvas: {
        focusId: "attention-flow",
        order: ["attention-flow"],
      },
    });
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
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
