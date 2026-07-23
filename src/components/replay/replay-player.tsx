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
import { ReplaySemanticCanvas } from "./replay-semantic-canvas";
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
  const [pictureInPicture, setPictureInPicture] = useState<ReplayVideoKind>();
  const leaderKind = selectReplayLeader(manifest);
  const controller = useReplayController(manifest, leaderKind);
  const client = useMemo(() => new ReplayClient(), []);
  const sourceFor = (kind: TrackKind) =>
    client.trackUrl(manifest.sessionId, kind);
  const changePrimary = (kind: ReplayVideoKind) => {
    setPrimary(kind);
    if (pictureInPicture === kind) setPictureInPicture(undefined);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-[96rem] px-5 py-6">
      <ReplayHeader startedAt={manifest.startedAt} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
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
          <ReplayTrackHealth manifest={manifest} />
        </div>
        <ReplayTranscript
          cues={timeline.transcript}
          currentMs={controller.currentMs}
          onSeek={controller.seek}
        />
      </div>
      <ReplaySemanticCanvas
        currentMs={controller.currentMs}
        events={timeline.canvasEvents}
      />
      <ReplayDownloads client={client} manifest={manifest} />
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
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Session replay
        </h1>
        <p className="text-muted mt-1">
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
  return available.includes("canvas") ? "canvas" : available[0];
}
