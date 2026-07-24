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
      className="border-border bg-surface rounded-2xl border"
    >
      <details>
        <summary className="cursor-pointer px-4 py-3 font-semibold">
          Downloads
        </summary>
        <div className="border-border grid max-h-52 gap-2 overflow-y-auto border-t p-3">
          {tracks.map((track) => (
            <a
              className="border-border rounded-lg border px-3 py-2 text-sm font-semibold"
              download={`${manifest.sessionId}-${track.kind}.webm`}
              href={client.trackUrl(manifest.sessionId, track.kind)}
              key={track.kind}
            >
              Download {trackLabel(track.kind)}
            </a>
          ))}
          <a
            className="bg-primary rounded-lg px-3 py-2 text-sm font-semibold text-white"
            download={`${manifest.sessionId}.chalkpilot.zip`}
            href={client.exportUrl(manifest.sessionId)}
          >
            Download session package
          </a>
        </div>
      </details>
    </section>
  );
}

function trackLabel(kind: TrackKind) {
  return kind === "desktop-audio" ? "desktop audio" : kind;
}
