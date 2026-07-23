// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceApi } from "./api";
import { createWorkspaceRepository } from "./repository";

describe("workspace API", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "chalkpilot-api-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true });
  });

  it("creates sessions and mutates their canvas", async () => {
    const api = createWorkspaceApi(createWorkspaceRepository(root));
    const created = await api.createSession();
    const session = await created.json();

    expect(created.status).toBe(201);

    const updated = await api.mutateCanvas(
      session.id,
      jsonRequest({
        action: "append",
        section: {
          id: "key-idea",
          kind: "markdown",
          title: "Key idea",
          content: "Start with your own attempt.",
        },
      }),
    );
    expect(updated.status).toBe(200);
    expect((await api.getCanvas(session.id)).status).toBe(200);
  });

  it("returns a bounded client error for invalid canvas input", async () => {
    const api = createWorkspaceApi(createWorkspaceRepository(root));
    const session = await (await api.createSession()).json();

    const response = await api.mutateCanvas(
      session.id,
      jsonRequest({ action: "focus", sectionId: "../unsafe" }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "The request was invalid.",
    });
  });

  it("accepts a complete structured section update", async () => {
    const api = createWorkspaceApi(createWorkspaceRepository(root));
    const session = await (await api.createSession()).json();
    const section = {
      id: "token-flow",
      kind: "chart",
      title: "Token flow",
      data: {
        variant: "line",
        series: [{ name: "Steps", points: [{ x: 1, y: 1 }] }],
      },
    };
    await api.mutateCanvas(
      session.id,
      jsonRequest({ action: "append", section }),
    );

    const response = await api.mutateCanvas(
      session.id,
      jsonRequest({
        action: "update",
        section: {
          ...section,
          title: "Token processing flow",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).sections["token-flow"]).toMatchObject({
      kind: "chart",
      title: "Token processing flow",
    });
  });

  it("rejects a partial canvas section update", async () => {
    const api = createWorkspaceApi(createWorkspaceRepository(root));
    const session = await (await api.createSession()).json();

    const response = await api.mutateCanvas(
      session.id,
      jsonRequest({
        action: "update",
        section: { id: "token-flow", title: "Incomplete" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "The request was invalid.",
    });
  });

  it("writes learner memory through the API", async () => {
    const api = createWorkspaceApi(createWorkspaceRepository(root));
    const session = await (await api.createSession()).json();

    const response = await api.remember(
      session.id,
      jsonRequest({
        claim: "Prefers a visual comparison.",
        evidence: "turn-1",
        scope: "calculus",
        confidence: 0.7,
      }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).entries).toHaveLength(1);
  });

  it("appends a validated transcript turn", async () => {
    const api = createWorkspaceApi(createWorkspaceRepository(root));
    const session = await (await api.createSession()).json();

    const response = await api.appendTranscript(
      session.id,
      jsonRequest({
        id: "turn-1-user",
        role: "user",
        text: "I think the gradient points uphill.",
        createdAt: "2026-07-23T08:00:00.000Z",
      }),
    );

    expect(response.status).toBe(201);
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
