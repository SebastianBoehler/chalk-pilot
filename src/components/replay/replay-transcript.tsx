"use client";

import type { ReplayTimeline } from "@/features/recording/schema";

export function ReplayTranscript({
  cues,
  currentMs,
  onSeek,
}: {
  cues: ReplayTimeline["transcript"];
  currentMs: number;
  onSeek(offsetMs: number): void;
}) {
  return (
    <section className="border-border bg-surface rounded-2xl border p-5">
      <h2 className="text-xl font-semibold">Transcript</h2>
      {cues.length ? (
        <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto">
          {cues.map((cue, index) => {
            const active = currentMs >= cue.startMs && currentMs <= cue.endMs;
            return (
              <button
                aria-current={active ? "true" : undefined}
                className={`w-full rounded-xl p-3 text-left transition ${
                  active ? "bg-primary/10 ring-primary/30 ring-2" : ""
                }`}
                key={`${cue.startMs}-${index}`}
                onClick={() => onSeek(cue.startMs)}
                type="button"
              >
                <span className="font-semibold">
                  {cue.speaker === "user" ? "You" : "Pilot"}
                </span>
                <span className="text-muted ml-2 text-sm">
                  {formatOffset(cue.startMs)}
                </span>
                <p className="mt-1 leading-relaxed">{cue.text}</p>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-muted mt-3">No transcript was recovered.</p>
      )}
    </section>
  );
}

function formatOffset(value: number) {
  const seconds = Math.floor(value / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
