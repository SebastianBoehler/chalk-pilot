"use client";

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
      className="border-border bg-surface mt-5 rounded-2xl border p-4"
    >
      <div className="flex items-center gap-4">
        <button
          className="bg-primary hover:bg-primary-hover min-w-24 rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-50"
          disabled={disabled}
          onClick={onTogglePlayback}
          type="button"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <label className="flex flex-1 items-center gap-3">
          <span className="sr-only">Replay position</span>
          <input
            className="accent-primary w-full"
            disabled={disabled}
            max={durationMs}
            min={0}
            onChange={(event) => onSeek(Number(event.target.value))}
            step={100}
            type="range"
            value={Math.min(currentMs, durationMs)}
          />
        </label>
        <time className="text-muted min-w-24 text-right tabular-nums">
          {`${formatTime(currentMs)} / ${formatTime(durationMs)}`}
        </time>
      </div>
    </section>
  );
}

function formatTime(value: number) {
  const seconds = Math.floor(value / 1_000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
