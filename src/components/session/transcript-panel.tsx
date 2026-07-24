"use client";

import { useEffect, useRef } from "react";
import { playCompletionChime } from "@/features/audio/completion-chime";
import type { TranscriptEntry } from "@/features/session/transcript";

export function TranscriptPanel({
  transcript,
}: {
  transcript: TranscriptEntry[];
}) {
  const completedTools = useRef<Set<string> | null>(null);

  useEffect(() => {
    const completed = transcript.filter(
      (entry) =>
        entry.role === "tool" &&
        entry.status === "completed" &&
        entry.toolName !== "delegate_canvas_task",
    );
    if (!completedTools.current) {
      completedTools.current = new Set(
        completed.map(({ sourceId }) => sourceId),
      );
      return;
    }
    for (const entry of completed) {
      if (completedTools.current.has(entry.sourceId)) continue;
      completedTools.current.add(entry.sourceId);
      playCompletionChime();
    }
  }, [transcript]);

  return (
    <details className="border-border mt-5 rounded-2xl border p-4" open>
      <summary className="cursor-pointer font-semibold">
        Transcript ({transcript.length})
      </summary>
      <div className="mt-3 max-h-72 space-y-3 overflow-auto">
        {transcript.length === 0 ? (
          <p className="text-muted text-sm">No completed turns yet.</p>
        ) : (
          transcript.map((entry) =>
            entry.role === "tool" ? (
              <div
                className="border-border bg-surface-muted rounded-xl border px-3 py-2"
                data-tool-call={entry.toolName}
                key={entry.sourceId}
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <strong>{readableToolName(entry.toolName)}</strong>
                  <span className={statusClass(entry.status)}>
                    {statusLabel(entry.status)}
                  </span>
                </div>
                {entry.text ? (
                  <p className="text-muted mt-1 text-xs leading-relaxed">
                    {entry.text}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm" key={entry.sourceId}>
                <strong>{entry.role === "user" ? "You" : "Pilot"}:</strong>{" "}
                {entry.text}
              </p>
            ),
          )
        )}
      </div>
    </details>
  );
}

function readableToolName(name: string) {
  return name
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function statusLabel(status: "running" | "completed" | "failed") {
  if (status === "running") return "Running";
  if (status === "completed") return "Completed";
  return "Failed";
}

function statusClass(status: "running" | "completed" | "failed") {
  if (status === "running") return "text-muted";
  if (status === "completed") return "text-success";
  return "text-danger";
}
