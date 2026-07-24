import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractText } from "unpdf";
import { parseStudySource, StudySourceParseError } from "./parsers";

vi.mock("unpdf", () => ({ extractText: vi.fn() }));

describe("study source parsers", () => {
  beforeEach(() => vi.mocked(extractText).mockReset());

  it("preserves PDF page provenance", async () => {
    vi.mocked(extractText).mockResolvedValue({
      text: [
        "Introduction to tokenization and vocabulary construction.",
        "Embeddings map token identifiers to learned vectors.",
      ],
      totalPages: 2,
    } as Awaited<ReturnType<typeof extractText>>);

    const result = await parseStudySource({
      fileName: "lecture.pdf",
      mimeType: "application/pdf",
      bytes: new TextEncoder().encode("%PDF-1.7 mock"),
    });

    expect(result.blocks).toEqual([
      {
        locator: "p. 1",
        text: "Introduction to tokenization and vocabulary construction.",
      },
      {
        locator: "p. 2",
        text: "Embeddings map token identifiers to learned vectors.",
      },
    ]);
  });

  it("preserves nested Markdown headings", async () => {
    const result = await parseStudySource({
      fileName: "notes.md",
      mimeType: "text/markdown",
      bytes: new TextEncoder().encode(
        "# Language models\nOverview.\n\n## Tokens\nSubword details.",
      ),
    });

    expect(result.blocks).toEqual([
      {
        locator: "Language models (line 1)",
        text: "Overview.",
      },
      {
        locator: "Language models > Tokens (line 4)",
        text: "Subword details.",
      },
    ]);
  });

  it("rejects PDFs without meaningful text", async () => {
    vi.mocked(extractText).mockResolvedValue({
      text: ["scan"],
      totalPages: 1,
    } as Awaited<ReturnType<typeof extractText>>);

    await expect(
      parseStudySource({
        fileName: "scan.pdf",
        mimeType: "application/pdf",
        bytes: new TextEncoder().encode("%PDF-1.7 mock"),
      }),
    ).rejects.toThrow(StudySourceParseError);
  });
});
