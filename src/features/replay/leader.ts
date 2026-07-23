import {
  TRACK_KINDS,
  type RecordingManifest,
  type TrackKind,
} from "@/features/recording/schema";

const TIE_PRIORITY: TrackKind[] = [
  "canvas",
  "board",
  "speaker",
  "microphone",
  "desktop-audio",
];

export function selectReplayLeader(
  manifest: RecordingManifest,
): TrackKind | undefined {
  if (
    !manifest.finalizedAt ||
    manifest.state === "recording" ||
    manifest.durationMs <= 0
  ) {
    return undefined;
  }
  const usable = TRACK_KINDS.map((kind) => manifest.tracks[kind]).filter(
    (track) =>
      track.byteSize > 0 && track.durationMs > 0 && track.mimeType !== null,
  );
  const preferred = usable.filter(
    (track) => track.health === "complete" || track.health === "healthy",
  );
  const candidates = preferred.length ? preferred : usable;
  return candidates.sort((left, right) => {
    const leftDistance = Math.abs(manifest.durationMs - left.durationMs);
    const rightDistance = Math.abs(manifest.durationMs - right.durationMs);
    return (
      leftDistance - rightDistance ||
      right.durationMs - left.durationMs ||
      TIE_PRIORITY.indexOf(left.kind) - TIE_PRIORITY.indexOf(right.kind)
    );
  })[0]?.kind;
}
