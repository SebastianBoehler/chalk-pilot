"use client";

import { useEffect, useRef } from "react";
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
  const activeCue = useRef<HTMLButtonElement>(null);
  const activeIndex = cues.findIndex(
    (cue) => currentMs >= cue.startMs && currentMs <= cue.endMs,
  );

  useEffect(() => {
    activeCue.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeIndex]);

  return (
    <section className="border-border bg-surface flex min-h-0 flex-1 flex-col rounded-2xl border p-4 lg:max-h-64 lg:flex-none">
      <h2 className="text-lg font-semibold">Transcript</h2>
      {cues.length ? (
        <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {cues.map((cue, index) => {
            const active = index === activeIndex;
            return (
              <button
                aria-current={active ? "true" : undefined}
                className={`w-full rounded-lg p-3 text-left transition ${
                  active ? "bg-primary/10 ring-primary/30 ring-2" : ""
                }`}
                key={`${cue.startMs}-${index}`}
                onClick={() => onSeek(cue.startMs)}
                ref={active ? activeCue : undefined}
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
