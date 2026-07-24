import type { RecordingManifest } from "@/features/recording/schema";

export function ReplayTrackHealth({
  manifest,
}: {
  manifest: RecordingManifest;
}) {
  const unavailable = Object.values(manifest.tracks).filter(
    (track) => track.byteSize === 0 || track.health === "interrupted",
  );
  if (!unavailable.length) return null;
  return (
    <section
      aria-label="Recording recovery"
      className="border-danger/25 bg-surface rounded-2xl border p-4"
    >
      <h2 className="font-semibold">Some recording evidence is incomplete</h2>
      <ul className="text-muted mt-2 list-disc space-y-1 pl-5 text-sm">
        {unavailable.map((track) => (
          <li key={track.kind}>
            {trackLabel(track.kind)}:{" "}
            {track.interruption?.message ?? "No recording data was recovered."}
          </li>
        ))}
      </ul>
    </section>
  );
}

function trackLabel(kind: string) {
  const label = kind === "desktop-audio" ? "Desktop audio" : kind;
  return `${label[0].toUpperCase()}${label.slice(1)}`;
}
