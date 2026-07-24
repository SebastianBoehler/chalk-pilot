import { describe, expect, it } from "vitest";
import { chunkStudyBlocks } from "./chunking";

describe("study chunking", () => {
  it("keeps provenance and splits long text deterministically", () => {
    const chunks = chunkStudyBlocks({
      packId: "pack-1",
      sourceId: "source-1",
      sourceTitle: "Lecture notes",
      blocks: [
        {
          locator: "p. 3",
          text: `${"A useful sentence. ".repeat(12)}${"word ".repeat(80)}`,
        },
      ],
      target: 120,
    });

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]).toMatchObject({
      id: "source-1-c-1",
      locator: "p. 3",
      ordinal: 0,
    });
    expect(chunks.every((chunk) => chunk.text.length <= 120)).toBe(true);
  });
});
