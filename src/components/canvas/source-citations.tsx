import type { SourceCitation } from "@/features/workspace/schema";

export function SourceCitations({
  citations,
}: {
  citations?: SourceCitation[];
}) {
  if (!citations?.length) return null;
  return (
    <footer
      aria-label="Sources"
      className="border-border text-muted mt-6 border-t pt-4 text-sm"
    >
      <span className="font-semibold">
        {citations.length === 1 ? "Source" : "Sources"}:
      </span>{" "}
      {citations.map((citation, index) => (
        <span key={citation.chunkId}>
          {index > 0 && "; "}
          {citation.sourceTitle}, {citation.locator}
        </span>
      ))}
    </footer>
  );
}
