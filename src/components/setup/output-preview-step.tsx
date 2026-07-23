"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { BoardController } from "@/features/board/board-controller";
import type { BoardCorners } from "@/features/board/types";
import { createDerivedVideoStreams } from "@/features/recording/derived-video-streams";

interface OutputPreviewStepProps {
  board: BoardController;
  corners: BoardCorners;
  sourceStream: MediaStream;
  sourceVideo: HTMLVideoElement;
  onBack: () => void;
  onContinue: () => void;
}

export function OutputPreviewStep({
  board,
  corners,
  sourceStream,
  sourceVideo,
  onBack,
  onContinue,
}: OutputPreviewStepProps) {
  const rawRef = useRef<HTMLVideoElement>(null);
  const boardRef = useRef<HTMLVideoElement>(null);
  const speakerRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();
  const sourceAvailable = sourceStream
    .getVideoTracks()
    .some((track) => track.readyState === "live");
  const previewError = sourceAvailable
    ? error
    : "The full room camera stream is unavailable.";

  useEffect(() => {
    const raw = rawRef.current;
    const corrected = boardRef.current;
    const speaker = speakerRef.current;
    if (!raw || !corrected || !speaker) return;
    if (!sourceAvailable) return;

    let active = true;
    let sampling = false;
    const derived = createDerivedVideoStreams(sourceVideo);
    raw.srcObject = sourceStream;
    corrected.srcObject = derived.board;
    speaker.srcObject = derived.speaker;
    void Promise.all([
      sourceVideo.play(),
      raw.play(),
      corrected.play(),
      speaker.play(),
    ]).catch((cause: unknown) => {
      if (active) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The output previews could not start.",
        );
      }
    });

    const sampleBoard = async () => {
      if (sampling) return;
      sampling = true;
      try {
        const image = await board.sample(sourceVideo, corners);
        await derived.updateBoard(image);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "The corrected board preview stopped.",
          );
        }
      } finally {
        sampling = false;
      }
    };
    void sampleBoard();
    const interval = window.setInterval(() => void sampleBoard(), 500);

    return () => {
      active = false;
      window.clearInterval(interval);
      derived.stop();
      raw.srcObject = null;
      corrected.srcObject = null;
      speaker.srcObject = null;
    };
  }, [board, corners, sourceAvailable, sourceStream, sourceVideo]);

  return (
    <section aria-labelledby="preview-title" className="space-y-6">
      <div>
        <h1
          className="text-4xl font-semibold tracking-tight"
          id="preview-title"
        >
          Check the output streams
        </h1>
        <p className="text-muted mt-3 max-w-3xl text-lg">
          Walk across the teaching area and confirm that the speaker crop
          follows you while the corrected board stays fixed and readable.
        </p>
      </div>

      {previewError && (
        <div className="border-danger/30 bg-danger/5 rounded-2xl border p-4">
          <p className="text-danger font-semibold">Preview needs attention</p>
          <p className="text-muted mt-1 text-sm">{previewError}</p>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <VideoPreview
          label="Full room camera"
          title="Full camera"
          videoRef={rawRef}
        />
        <VideoPreview
          label="Corrected board video"
          title="Corrected board"
          videoRef={boardRef}
        />
        <VideoPreview
          label="Tracked speaker video"
          title="Tracked speaker"
          videoRef={speakerRef}
        />
      </div>

      <div className="flex flex-wrap justify-between gap-3">
        <Button onClick={onBack} type="button" variant="secondary">
          Adjust board frame
        </Button>
        <Button
          disabled={Boolean(previewError)}
          onClick={onContinue}
          type="button"
        >
          Outputs look right
        </Button>
      </div>
    </section>
  );
}

function VideoPreview({
  label,
  title,
  videoRef,
}: {
  label: string;
  title: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  return (
    <article>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <video
        aria-label={label}
        autoPlay
        className="border-border aspect-video w-full rounded-2xl border bg-black object-contain"
        muted
        playsInline
        ref={videoRef}
      />
    </article>
  );
}
