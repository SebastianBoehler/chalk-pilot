import type { RealtimeItem } from "@openai/agents/realtime";

export interface TranscriptLine {
  sourceId: string;
  role: "user" | "assistant";
  text: string;
}

export interface TranscriptToolCall {
  sourceId: string;
  role: "tool";
  toolName: string;
  status: "running" | "completed" | "failed";
  text: string;
}

export type TranscriptEntry = TranscriptLine | TranscriptToolCall;

export function extractTranscript(history: RealtimeItem[]): TranscriptEntry[] {
  return history.flatMap<TranscriptEntry>((item): TranscriptEntry[] => {
    if (item.type === "message") {
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
    }
    if (
      item.type !== "function_call" &&
      item.type !== "mcp_call" &&
      item.type !== "mcp_tool_call"
    ) {
      return [];
    }
    return [
      {
        sourceId: item.itemId,
        role: "tool",
        toolName: item.name,
        status:
          item.status === "in_progress"
            ? "running"
            : item.status === "completed"
              ? "completed"
              : "failed",
        text: summarizeToolCall(item.arguments, item.output),
      },
    ];
  });
}

export function persistTranscript(
  history: RealtimeItem[],
  sessionId: string,
  persisted: Set<string>,
  update: (lines: TranscriptEntry[]) => void,
  onPersistedLine?: (line: TranscriptLine) => void,
) {
  const lines = extractTranscript(history);
  update(lines);
  for (const line of lines) {
    if (line.role === "tool") continue;
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

function summarizeToolCall(argumentsJson: string, outputJson: string | null) {
  const parts = [
    ...readablePairs(argumentsJson),
    ...readablePairs(outputJson),
  ].slice(0, 4);
  return parts.join(" · ");
}

function readablePairs(raw: string | null) {
  if (!raw?.trim()) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (Array.isArray(value)) return [`Results: ${value.length} items`];
    if (!value || typeof value !== "object") return [truncate(String(value))];
    return Object.entries(value)
      .filter(([key]) => !/(?:audio|image|key|secret|token)/i.test(key))
      .flatMap(([key, entry]) => {
        const formatted = readableValue(entry);
        return formatted ? [`${readableKey(key)}: ${formatted}`] : [];
      });
  } catch {
    return [truncate(raw.trim())];
  }
}

function readableValue(value: unknown) {
  if (typeof value === "string") return truncate(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return `${value.length} items`;
}

function readableKey(key: string) {
  const labels: Record<string, string> = {
    jobId: "Job",
    sectionId: "Section",
    targetId: "Target",
  };
  return (
    labels[key] ??
    key
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (letter) => letter.toUpperCase())
  );
}

function truncate(value: string) {
  return value.length > 140 ? `${value.slice(0, 137)}…` : value;
}
