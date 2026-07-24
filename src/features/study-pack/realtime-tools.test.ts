import { describe, expect, it, vi } from "vitest";
import { createStudyPackActions } from "./realtime-tools";

const source = {
  id: "source-1",
  packId: "pack-1",
  title: "Lecture 4",
  fileName: "lecture-4.md",
  format: "markdown" as const,
  mimeType: "text/markdown",
  sizeBytes: 100,
  chunkCount: 1,
  locators: ["Variational inference"],
  createdAt: "2026-07-24T08:00:00.000Z",
};
const chunk = {
  id: "source-1-c-1",
  packId: "pack-1",
  sourceId: source.id,
  sourceTitle: source.title,
  locator: "Variational inference",
  ordinal: 0,
  text: "Reverse KL has a zero-forcing tendency.",
};

describe("Realtime study-pack actions", () => {
  it("loads the selected outline with source provenance", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        id: "pack-1",
        title: "Probabilistic ML",
        sources: [source],
      }),
    );
    const actions = createStudyPackActions({
      sessionId: "session-1",
      fetcher,
    });

    await expect(actions.outline()).resolves.toMatchObject({
      title: "Probabilistic ML",
      sources: [{ title: "Lecture 4" }],
    });
    expect(fetcher).toHaveBeenCalledWith("/api/sessions/session-1/study-pack");
  });

  it("searches and reads canonical passages without losing provenance", async () => {
    const fetcher = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        if (String(input).endsWith("/search")) {
          expect(init?.body).toBe(
            JSON.stringify({ query: "zero forcing", limit: 3 }),
          );
          return Response.json({ results: [{ ...chunk, score: 4.2 }] });
        }
        return Response.json({
          current: chunk,
          previous: null,
          next: null,
        });
      },
    );
    const actions = createStudyPackActions({
      sessionId: "session-1",
      fetcher,
    });

    await expect(
      actions.search({ query: "zero forcing", limit: 3 }),
    ).resolves.toMatchObject({
      results: [{ id: chunk.id, locator: chunk.locator }],
    });
    await expect(actions.passage({ chunkId: chunk.id })).resolves.toMatchObject(
      {
        current: { id: chunk.id, sourceTitle: source.title },
      },
    );
  });

  it("surfaces a bounded retrieval error", async () => {
    const actions = createStudyPackActions({
      sessionId: "session-1",
      fetcher: vi.fn(async () =>
        Response.json({ error: "No study pack is selected." }, { status: 404 }),
      ),
    });

    await expect(actions.passage({ chunkId: chunk.id })).rejects.toThrow(
      "No study pack is selected.",
    );
  });
});
