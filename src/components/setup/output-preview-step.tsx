"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { BoardController } from "@/features/board/board-controller";
import type { BoardCorners } from "@/features/board/types";
import { createDerivedVideoStreams } from "@/features/recording/derived-video-streams";
import {
  selectPresenter,
  type PersonBox,
  type PresenterState,
} from "@/features/recording/presenter-tracker";
import type { CameraUse } from "@/features/setup/camera-use";
import { PresenterSelection, VideoPreview } from "./output-preview-video";

interface OutputPreviewStepProps {
  board: BoardController;
  cameraUse: CameraUse;
  corners: BoardCorners;
  sourceStream: MediaStream;
  sourceVideo: HTMLVideoElement;
  onBack: () => void;
  onContinue: (presenter?: PersonBox) => void;
}

export function OutputPreviewStep({
  board,
  cameraUse,
  corners,
  sourceStream,
  sourceVideo,
  onBack,
  onContinue,
}: OutputPreviewStepProps) {
  const rawRef = useRef<HTMLVideoElement>(null);
  const boardRef = useRef<HTMLVideoElement>(null);
  const speakerRef = useRef<HTMLVideoElement>(null);
  const derivedRef = useRef<ReturnType<
    typeof createDerivedVideoStreams
  > | null>(null);
  const [boxes, setBoxes] = useState<PersonBox[]>([]);
  const [presenter, setPresenter] = useState<PersonBox>();
  const [tracking, setTracking] = useState<PresenterState>();
  const [error, setError] = useState<string>();
  const [sourceSize, setSourceSize] = useState({
    height: sourceVideo.videoHeight,
    width: sourceVideo.videoWidth,
  });
  const sourceAvailable = sourceStream
    .getVideoTracks()
    .some((track) => track.readyState === "live");
  const previewError = sourceAvailable
    ? error
    : "The full room camera stream is unavailable.";

  useEffect(() => {
    const updateSize = () =>
      setSourceSize({
        height: sourceVideo.videoHeight,
        width: sourceVideo.videoWidth,
      });
    sourceVideo.addEventListener("loadedmetadata", updateSize);
    sourceVideo.addEventListener("resize", updateSize);
    return () => {
      sourceVideo.removeEventListener("loadedmetadata", updateSize);
      sourceVideo.removeEventListener("resize", updateSize);
    };
  }, [sourceVideo]);

  useEffect(() => {
    const raw = rawRef.current;
    const corrected = boardRef.current;
    const speaker = speakerRef.current;
    if (!raw || !corrected || !speaker || !sourceAvailable) return;

    let active = true;
    let sampling = false;
    setBoxes([]);
    setPresenter(undefined);
    setTracking(undefined);
    setError(undefined);
    const derived = createDerivedVideoStreams(sourceVideo, {
      cameraUse,
      onDetections: (detections) => {
        if (active) setBoxes(detections);
      },
      onTrackingError: (message) => {
        if (active) setError(message);
      },
      onTrackingState: (state) => {
        if (!active) return;
        setTracking(state ?? undefined);
        if (state) setPresenter(state.box);
      },
      presenter: null,
    });
    derivedRef.current = derived;
    raw.srcObject = sourceStream;
    corrected.srcObject = derived.board;
    speaker.srcObject = derived.speaker;
    void Promise.all([
      sourceVideo.play(),
      raw.play(),
      corrected.play(),
      speaker.play(),
    ]).catch((cause: unknown) => {
      if (active)
        setError(errorMessage(cause, "The previews could not start."));
    });

    const sampleBoard = async () => {
      if (sampling) return;
      sampling = true;
      try {
        await derived.updateBoard(await board.sample(sourceVideo, corners));
      } catch (cause) {
        if (active)
          setError(errorMessage(cause, "The corrected board preview stopped."));
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
      derivedRef.current = null;
      raw.srcObject = null;
      corrected.srcObject = null;
      speaker.srcObject = null;
    };
  }, [board, cameraUse, corners, sourceAvailable, sourceStream, sourceVideo]);

  const choosePresenter = (event: React.MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    try {
      const selected = selectPresenter(boxes, {
        x: (event.clientX - bounds.left) / bounds.width,
        y: (event.clientY - bounds.top) / bounds.height,
      });
      derivedRef.current?.confirmPresenter(selected);
      setPresenter(selected);
      setError(undefined);
    } catch (cause) {
      setError(errorMessage(cause, "Select a detected presenter."));
    }
  };

  const presenterRequired = cameraUse === "room-wide";
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
          {presenterRequired
            ? "Click yourself in the full camera view, then walk across the teaching area to test tracking."
            : "Confirm the fixed camera and corrected board remain framed and readable."}
        </p>
      </div>

      {previewError && (
        <div className="border-danger/30 bg-danger/5 rounded-2xl border p-4">
          <p className="text-danger font-semibold">Preview needs attention</p>
          <p className="text-muted mt-1 text-sm">{previewError}</p>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        {presenterRequired ? (
          <PresenterSelection
            boxes={boxes}
            onSelect={choosePresenter}
            presenter={presenter}
            size={sourceSize}
            videoRef={rawRef}
          />
        ) : (
          <VideoPreview
            label="Full fixed camera"
            title="Fixed camera"
            videoRef={rawRef}
          />
        )}
        <VideoPreview
          label="Corrected board video"
          title="Corrected board"
          videoRef={boardRef}
        />
        <VideoPreview
          label="Speaker video"
          title={
            presenterRequired ? "Tracked presenter" : "Fixed camera output"
          }
          videoRef={speakerRef}
        />
      </div>

      {presenterRequired && (
        <p aria-live="polite" className="text-sm font-semibold">
          {tracking?.status === "lost"
            ? "Presenter temporarily lost"
            : presenter
              ? "Presenter confirmed"
              : boxes.length
                ? "Click your outline to confirm"
                : "Looking for presenters…"}
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <Button onClick={onBack} type="button" variant="secondary">
          Adjust board frame
        </Button>
        <Button
          disabled={Boolean(previewError) || (presenterRequired && !presenter)}
          onClick={() => onContinue(presenter)}
          type="button"
        >
          Outputs look right
        </Button>
      </div>
    </section>
  );
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}
