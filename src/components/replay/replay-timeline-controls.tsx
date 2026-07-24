"use client";

import type { CSSProperties } from "react";

export function ReplayTimelineControls({
  currentMs,
  durationMs,
  playing,
  disabled,
  onSeek,
  onTogglePlayback,
}: {
  currentMs: number;
  durationMs: number;
  playing: boolean;
  disabled: boolean;
  onSeek(value: number): void;
  onTogglePlayback(): void;
}) {
  return (
    <section
      aria-label="Playback controls"
      className="border-border bg-surface mt-3 rounded-xl border px-3 py-2"
    >
      <div className="flex items-center gap-3">
        <button
          aria-label={playing ? "Pause" : "Play"}
          className="bg-primary hover:bg-primary-hover grid size-10 shrink-0 place-items-center rounded-lg text-white disabled:opacity-50"
          disabled={disabled}
          onClick={onTogglePlayback}
          type="button"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <label className="flex flex-1 items-center gap-3">
          <span className="sr-only">Replay position</span>
          <input
            className="replay-range w-full"
            disabled={disabled}
            max={durationMs}
            min={0}
            onChange={(event) => onSeek(Number(event.target.value))}
            step={100}
            type="range"
            value={Math.min(currentMs, durationMs)}
            style={
              {
                "--range-progress": `${durationMs ? (Math.min(currentMs, durationMs) / durationMs) * 100 : 0}%`,
              } as CSSProperties
            }
          />
        </label>
        <time className="text-muted min-w-20 text-right text-sm tabular-nums">
          {`${formatTime(currentMs)} / ${formatTime(durationMs)}`}
        </time>
      </div>
    </section>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20">
      <path d="M6 4.6v10.8L15 10 6 4.6Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 20 20">
      <path d="M5.5 4h3v12h-3V4Zm6 0h3v12h-3V4Z" fill="currentColor" />
    </svg>
  );
}

function formatTime(value: number) {
  const seconds = Math.floor(value / 1_000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
