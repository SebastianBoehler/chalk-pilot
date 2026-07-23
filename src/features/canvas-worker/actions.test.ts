// @vitest-environment node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceRepository } from "@/features/workspace/repository";
import { createCanvasWorkerActions } from "./actions";
import { canvasJobRequestSchema } from "./schema";

describe("canvas worker actions", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "chalkpilot-canvas-worker-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true });
  });

  it("upserts and focuses one validated canvas section", async () => {
    const repository = createWorkspaceRepository(root);
    const session = await repository.createSession();
    const actions = createCanvasWorkerActions(repository, session.id);

    await actions.upsertSection({
      id: "gradient-comparison",
      kind: "markdown",
      title: "Gradient comparison",
      content: "The gradient points uphill.",
    });
    await actions.upsertSection({
      id: "gradient-comparison",
      kind: "markdown",
      title: "Gradient descent comparison",
      content: "Gradient descent moves in the negative-gradient direction.",
    });
    await actions.focusSection({ sectionId: "gradient-comparison" });

    const canvas = await actions.readCanvas();
    expect(canvas.order).toEqual(["gradient-comparison"]);
    expect(canvas.focusId).toBe("gradient-comparison");
    expect(canvas.sections["gradient-comparison"]).toMatchObject({
      title: "Gradient descent comparison",
      content: "Gradient descent moves in the negative-gradient direction.",
    });
  });

  it("upserts a structured artifact with its complete payload", async () => {
    const repository = createWorkspaceRepository(root);
    const session = await repository.createSession();
    const actions = createCanvasWorkerActions(repository, session.id);

    await actions.upsertSection({
      id: "token-types",
      kind: "comparison",
      title: "Token types",
      data: {
        columns: [
          { heading: "Word", summary: "Whole words", points: ["intuitive"] },
          { heading: "Subword", summary: "Pieces", points: ["flexible"] },
        ],
      },
    });
    await actions.upsertSection({
      id: "token-types",
      kind: "comparison",
      title: "Token type tradeoffs",
      data: {
        columns: [
          { heading: "Word", summary: "Whole words", points: ["intuitive"] },
          { heading: "Subword", summary: "Pieces", points: ["flexible"] },
        ],
      },
    });

    expect((await actions.readCanvas()).sections["token-types"]).toMatchObject({
      kind: "comparison",
      title: "Token type tradeoffs",
      data: { columns: [{ heading: "Word" }, { heading: "Subword" }] },
    });
  });

  it("validates a bounded canvas job", () => {
    expect(
      canvasJobRequestSchema.parse({
        jobId: "job-1",
        goal: "Create a visual contrast between ascent and descent.",
        artifact: "comparison",
        boardImage: "data:image/jpeg;base64,Ym9hcmQ=",
      }),
    ).toMatchObject({
      jobId: "job-1",
      artifact: "comparison",
    });

    expect(() =>
      canvasJobRequestSchema.parse({
        jobId: "../unsafe",
        goal: "",
        artifact: "anything",
      }),
    ).toThrow();
  });
});
