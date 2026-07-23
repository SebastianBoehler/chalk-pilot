import {
  createPoseWorkerClient,
  type PoseWorkerClient,
} from "./pose-worker-client";
import type { PersonBox } from "./presenter-tracker";

interface PoseDetector {
  detect(frame: ImageBitmap, timestampMs: number): Promise<PersonBox[]>;
  dispose(): void;
}

interface DetectionCallbacks {
  onBoxes: (boxes: PersonBox[]) => void;
  onError: (message: string) => void;
}

interface DetectionDependencies {
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
  createBitmap: (
    source: CanvasImageSource,
    options: ImageBitmapOptions,
  ) => Promise<ImageBitmap>;
}

export interface PresenterDetectionLoop {
  stop(): void;
}

const MIN_DETECTION_INTERVAL_MS = 125;
const MAX_DETECTION_WIDTH = 640;

export function startPresenterDetection(
  video: HTMLVideoElement,
  detector: PoseDetector = createPoseWorkerClient(),
  callbacks: DetectionCallbacks,
  dependencies: Partial<DetectionDependencies> = {},
): PresenterDetectionLoop {
  const requestFrame =
    dependencies.requestFrame ?? window.requestAnimationFrame.bind(window);
  const cancelFrame =
    dependencies.cancelFrame ?? window.cancelAnimationFrame.bind(window);
  const createBitmap = dependencies.createBitmap ?? createImageBitmap;
  let active = true;
  let frameHandle = 0;
  let detectionActive = false;
  let lastDetectionAt = Number.NEGATIVE_INFINITY;

  const render = (timestampMs: number) => {
    if (!active) return;
    frameHandle = requestFrame(render);
    if (
      detectionActive ||
      timestampMs - lastDetectionAt < MIN_DETECTION_INTERVAL_MS ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return;
    }
    lastDetectionAt = timestampMs;
    detectionActive = true;
    const size = detectionSize(video.videoWidth, video.videoHeight);
    void createBitmap(video, {
      resizeHeight: size.height,
      resizeQuality: "medium",
      resizeWidth: size.width,
    })
      .then((frame) => detector.detect(frame, timestampMs))
      .then((boxes) => {
        if (active) callbacks.onBoxes(boxes);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        callbacks.onError(
          cause instanceof Error
            ? cause.message
            : "Presenter detection failed.",
        );
      })
      .finally(() => {
        detectionActive = false;
      });
  };
  frameHandle = requestFrame(render);

  return {
    stop() {
      if (!active) return;
      active = false;
      cancelFrame(frameHandle);
      detector.dispose();
    },
  };
}

export function detectionSize(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    throw new Error("Presenter detection requires a live camera frame.");
  }
  const scale = Math.min(1, MAX_DETECTION_WIDTH / width);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export type { PoseWorkerClient };
