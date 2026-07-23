import type { RealtimeItem } from "@openai/agents/realtime";

export interface TranscriptLine {
  sourceId: string;
  role: "user" | "assistant";
  text: string;
}

export function extractTranscript(history: RealtimeItem[]): TranscriptLine[] {
  return history.flatMap((item) => {
    if (item.type !== "message") return [];
    if (item.role !== "user" && item.role !== "assistant") return [];
    if (item.status !== "completed") return [];
    const text = item.content
      .map((part) =>
        "text" in part
          ? part.text
          : "transcript" in part
            ? part.transcript
            : "",
      )
      .filter(Boolean)
      .join(" ")
      .trim();
    return text ? [{ sourceId: item.itemId, role: item.role, text }] : [];
  });
}

export function persistTranscript(
  history: RealtimeItem[],
  sessionId: string,
  persisted: Set<string>,
  update: (lines: TranscriptLine[]) => void,
  onPersistedLine?: (line: TranscriptLine) => void,
) {
  const lines = extractTranscript(history);
  update(lines);
  for (const line of lines) {
    if (persisted.has(line.sourceId)) continue;
    persisted.add(line.sourceId);
    onPersistedLine?.(line);
    const index = persisted.size;
    void fetch(`/api/sessions/${sessionId}/transcript`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: `turn-${index}-${line.role}`,
        role: line.role,
        text: line.text,
        createdAt: new Date().toISOString(),
      }),
    });
  }
}
