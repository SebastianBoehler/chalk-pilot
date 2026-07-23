import Link from "next/link";
import type { RecordingSummary } from "@/features/recording/schema";

export function ReplayLibrary({
  summaries,
  error,
}: {
  summaries: RecordingSummary[];
  error?: string;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Replay Studio
          </h1>
          <p className="text-muted mt-2 text-lg">
            Revisit the board, canvas, conversation, and room audio together.
          </p>
        </div>
        <Link
          className="border-border bg-surface rounded-xl border px-4 py-3 font-semibold"
          href="/setup"
        >
          New session
        </Link>
      </header>
      {error ? (
        <p
          className="border-danger/30 bg-surface text-danger rounded-2xl border p-5"
          role="alert"
        >
          {error}
        </p>
      ) : summaries.length === 0 ? (
        <section className="border-border bg-surface rounded-3xl border p-10 text-center shadow-sm">
          <h2 className="text-2xl font-semibold">No recordings yet.</h2>
          <p className="text-muted mt-3">
            Finish a recording to review it here.
          </p>
        </section>
      ) : (
        <div className="grid gap-5">
          {summaries.map((summary) => (
            <RecordingCard key={summary.sessionId} summary={summary} />
          ))}
        </div>
      )}
    </main>
  );
}

function RecordingCard({ summary }: { summary: RecordingSummary }) {
  return (
    <article className="border-border bg-surface rounded-3xl border p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h2 className="text-2xl font-semibold">
            {formatStart(summary.startedAt)}
          </h2>
          <p className="text-muted mt-2">
            {formatDuration(summary.durationMs)} · {stateLabel(summary.state)}
          </p>
          <p className="text-muted mt-3 text-sm">
            {summary.availableTracks.length
              ? summary.availableTracks.map(trackLabel).join(" · ")
              : "No recoverable tracks"}
          </p>
        </div>
        <Link
          aria-label={`Open recording from ${formatStart(summary.startedAt)}`}
          className="bg-primary hover:bg-primary-hover rounded-xl px-5 py-3 font-semibold text-white"
          href={`/replay/${encodeURIComponent(summary.sessionId)}`}
        >
          Open recording
        </Link>
      </div>
    </article>
  );
}

function formatStart(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(durationMs: number) {
  const seconds = Math.floor(durationMs / 1_000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function stateLabel(state: RecordingSummary["state"]) {
  if (state === "complete") return "Complete";
  if (state === "interrupted") return "Needs attention";
  return "Recording";
}

function trackLabel(track: RecordingSummary["availableTracks"][number]) {
  if (track === "desktop-audio") return "Desktop audio";
  return `${track[0].toUpperCase()}${track.slice(1)}`;
}
