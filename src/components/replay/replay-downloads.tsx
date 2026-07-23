import type { RecordingManifest, TrackKind } from "@/features/recording/schema";
import type { ReplayClientPort } from "@/features/replay/client";

export function ReplayDownloads({
  manifest,
  client,
}: {
  manifest: RecordingManifest;
  client: Pick<ReplayClientPort, "trackUrl" | "exportUrl">;
}) {
  const tracks = Object.values(manifest.tracks).filter(
    (track) => track.byteSize > 0,
  );
  return (
    <section
      aria-label="Downloads"
      className="border-border bg-surface mt-8 rounded-2xl border p-5"
    >
      <h2 className="text-xl font-semibold">Downloads</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {tracks.map((track) => (
          <a
            className="border-border rounded-lg border px-3 py-2 text-sm font-semibold"
            download
            href={client.trackUrl(manifest.sessionId, track.kind)}
            key={track.kind}
          >
            Download {trackLabel(track.kind)}
          </a>
        ))}
        <a
          className="bg-primary rounded-lg px-3 py-2 text-sm font-semibold text-white"
          download
          href={client.exportUrl(manifest.sessionId)}
        >
          Download session package
        </a>
      </div>
    </section>
  );
}

function trackLabel(kind: TrackKind) {
  return kind === "desktop-audio" ? "desktop audio" : kind;
}
