"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ReplayClient } from "@/features/replay/client";
import { selectReplayLeader } from "@/features/replay/leader";
import type {
  RecordingManifest,
  ReplayTimeline,
  TrackKind,
} from "@/features/recording/schema";
import { ReplayAudioControls } from "./replay-audio-controls";
import { ReplayDownloads } from "./replay-downloads";
import { ReplayMediaStage, type ReplayVideoKind } from "./replay-media-stage";
import { ReplayTimelineControls } from "./replay-timeline-controls";
import { ReplayTrackHealth } from "./replay-track-health";
import { ReplayTranscript } from "./replay-transcript";
import { useReplayController } from "./use-replay-controller";

const VIDEO_KINDS: ReplayVideoKind[] = ["board", "speaker", "canvas"];
const AUDIO_KINDS = ["microphone", "desktop-audio"] as const;

export function ReplayPlayer({
  manifest,
  timeline,
}: {
  manifest: RecordingManifest;
  timeline: ReplayTimeline;
}) {
  if (manifest.state === "recording" || !manifest.finalizedAt) {
    return <RecordingInProgress manifest={manifest} />;
  }
  return <FinalizedReplay manifest={manifest} timeline={timeline} />;
}

function FinalizedReplay({
  manifest,
  timeline,
}: {
  manifest: RecordingManifest;
  timeline: ReplayTimeline;
}) {
  const videos = VIDEO_KINDS.filter(
    (kind) => manifest.tracks[kind].byteSize > 0,
  );
  const audio = AUDIO_KINDS.filter(
    (kind) => manifest.tracks[kind].byteSize > 0,
  );
  const [primary, setPrimary] = useState<ReplayVideoKind | undefined>(
    preferredPrimary(videos),
  );
  const [pictureInPicture, setPictureInPicture] = useState<
    ReplayVideoKind | undefined
  >(() => preferredSecondary(videos, preferredPrimary(videos)));
  const leaderKind = selectReplayLeader(manifest);
  const controller = useReplayController(manifest, leaderKind);
  const client = useMemo(() => new ReplayClient(), []);
  const sourceFor = (kind: TrackKind) =>
    client.trackUrl(manifest.sessionId, kind);
  const changePrimary = (kind: ReplayVideoKind) => {
    setPrimary((current) => {
      if (pictureInPicture === kind) setPictureInPicture(current);
      return kind;
    });
  };

  return (
    <main
      className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-[96rem] flex-col px-5 py-4 lg:h-[calc(100svh-4rem)] lg:overflow-hidden"
      data-replay-studio
    >
      <ReplayHeader startedAt={manifest.startedAt} />
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-h-0 flex-col">
          <ReplayMediaStage
            available={videos}
            onPictureInPicture={setPictureInPicture}
            onPrimary={changePrimary}
            pictureInPicture={pictureInPicture}
            primary={primary}
            refs={controller.refs}
            sourceFor={sourceFor}
          />
          <ReplayTimelineControls
            currentMs={controller.currentMs}
            disabled={!controller.hasLeader}
            durationMs={manifest.durationMs}
            onSeek={controller.seek}
            onTogglePlayback={controller.togglePlayback}
            playing={controller.playing}
          />
          {controller.error && (
            <p
              className="border-danger/30 bg-surface text-danger mt-4 rounded-xl border p-4"
              role="alert"
            >
              {controller.error}
            </p>
          )}
          {!leaderKind && (
            <p
              className="border-danger/30 bg-surface text-danger mt-4 rounded-xl border p-4"
              role="alert"
            >
              No track has a usable playback duration. Downloads remain
              available for recovered files.
            </p>
          )}
          <ReplayAudioControls
            available={[...audio]}
            refs={controller.refs}
            sourceFor={sourceFor}
          />
        </div>
        <aside className="flex min-h-0 flex-col gap-3">
          <ReplayTranscript
            cues={timeline.transcript}
            currentMs={controller.currentMs}
            onSeek={controller.seek}
          />
          <ReplayTrackHealth manifest={manifest} />
          <ReplayDownloads client={client} manifest={manifest} />
        </aside>
      </div>
    </main>
  );
}

function RecordingInProgress({ manifest }: { manifest: RecordingManifest }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-6">
      <ReplayHeader startedAt={manifest.startedAt} />
      <p
        className="border-primary/30 bg-surface rounded-2xl border p-6"
        role="alert"
      >
        This recording is still in progress. Stop and finalize it before opening
        Replay Studio.
      </p>
    </main>
  );
}

function ReplayHeader({ startedAt }: { startedAt: string }) {
  return (
    <header className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Replay Studio</h1>
        <p className="text-muted text-sm">
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(startedAt))}
        </p>
      </div>
      <Link
        className="border-border bg-surface rounded-xl border px-4 py-3 font-semibold"
        href="/replay"
      >
        All recordings
      </Link>
    </header>
  );
}

function preferredPrimary(available: ReplayVideoKind[]) {
  return available.includes("board")
    ? "board"
    : available.includes("canvas")
      ? "canvas"
      : available[0];
}

function preferredSecondary(
  available: ReplayVideoKind[],
  primary?: ReplayVideoKind,
) {
  return (["speaker", "canvas", "board"] as const).find(
    (kind) => kind !== primary && available.includes(kind),
  );
}
