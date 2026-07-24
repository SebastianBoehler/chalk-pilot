// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceRepository } from "@/features/workspace/repository";
import { createStudyPackApi } from "./api";
import { createStudyPackRepository } from "./repository";

describe("study pack API", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "chalkpilot-study-api-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates, uploads, and retrieves session-bound evidence", async () => {
    const packs = createStudyPackRepository(root);
    const workspace = createWorkspaceRepository(root);
    const api = createStudyPackApi(packs, workspace);
    const created = await api.create(
      jsonRequest({ title: "Probabilistic ML" }),
    );
    const pack = (await created.json()) as { id: string };
    expect(await (await api.list()).json()).toMatchObject([
      { id: pack.id, title: "Probabilistic ML" },
    ]);
    expect(await (await api.read(pack.id)).json()).toMatchObject({
      id: pack.id,
      sources: [],
    });
    const form = new FormData();
    form.set(
      "file",
      new File(
        [
          "Variational inference minimizes reverse KL divergence.\n\n" +
            "The course calls this the zero-forcing tendency.",
        ],
        "lecture.txt",
        { type: "text/plain" },
      ),
    );
    expect((await api.upload(pack.id, formRequest(form))).status).toBe(201);
    const session = await workspace.createSession({ studyPackId: pack.id });

    expect(await (await api.sessionOutline(session.id)).json()).toMatchObject({
      id: pack.id,
      sources: [{ title: "lecture" }],
    });
    expect(
      await (
        await api.sessionSearch(
          session.id,
          jsonRequest({ query: "zero forcing" }),
        )
      ).json(),
    ).toMatchObject({
      results: [
        {
          sourceTitle: "lecture",
          locator: "Paragraph 2",
        },
      ],
    });

    const otherPack = await packs.createPack("Other");
    const hit = (
      (await (
        await api.sessionSearch(
          session.id,
          jsonRequest({ query: "zero forcing" }),
        )
      ).json()) as { results: Array<{ id: string }> }
    ).results[0];
    const otherSession = await workspace.createSession({
      studyPackId: otherPack.id,
    });
    expect((await api.sessionPassage(otherSession.id, hit.id)).status).toBe(
      404,
    );
  });

  it("returns bounded errors for unsupported uploads and unknown packs", async () => {
    const packs = createStudyPackRepository(root);
    const api = createStudyPackApi(packs);
    const form = new FormData();
    form.set(
      "file",
      new File(["data"], "slides.pptx", {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
    );

    expect((await api.upload("missing", formRequest(form))).status).toBe(404);
    const pack = await packs.createPack("Course");
    const invalid = await api.upload(pack.id, formRequest(form));
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toEqual({
      error: "Use a PDF, Markdown, or plain text file.",
    });
  });
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formRequest(body: FormData) {
  return new Request("http://localhost/api", { method: "POST", body });
}
