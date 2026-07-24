// @vitest-environment node

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStudyPackRepository } from "./repository";

describe("study pack repository", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "chalkpilot-study-pack-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("persists reusable sources and retrieves rare course language", async () => {
    const repository = createStudyPackRepository(root);
    const pack = await repository.createPack("NLP lecture 4");
    const upload = await repository.uploadSource(pack.id, {
      fileName: "notes.txt",
      mimeType: "text/plain",
      bytes: new TextEncoder().encode(
        "A tokenizer segments text into subword units.\n\n" +
          "The orthogonal zebra criterion is the distinctive course phrase.",
      ),
    });

    expect((await repository.listPacks())[0].sources).toHaveLength(1);
    expect(await repository.search(pack.id, "orthogonal zebra")).toEqual([
      expect.objectContaining({
        sourceId: upload.source.id,
        locator: "Paragraph 2",
      }),
    ]);
    const passage = await repository.passage(
      pack.id,
      `${upload.source.id}-c-2`,
    );
    expect(passage?.previous?.locator).toBe("Paragraph 1");
    expect(
      await readFile(
        join(
          root,
          "study-packs",
          pack.id,
          "sources",
          upload.source.id,
          "original.txt",
        ),
        "utf8",
      ),
    ).toContain("orthogonal zebra");
  });
});
