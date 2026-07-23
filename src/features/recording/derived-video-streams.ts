import { startPresenterDetection } from "./presenter-detection-loop";
import type { CameraUse } from "@/features/setup/camera-use";
import {
  interpolatePresenterBox,
  presenterCrop,
  updatePresenter,
  type PersonBox,
  type PresenterState,
} from "./presenter-tracker";

export interface DerivedVideoStreams {
  board: MediaStream;
  speaker: MediaStream;
  confirmPresenter(presenter: PersonBox): void;
  updateBoard(imageUrl: string): Promise<void>;
  stop(): void;
}

export interface DerivedVideoStreamOptions {
  cameraUse: CameraUse;
  presenter: PersonBox | null;
  onDetections?: (boxes: PersonBox[]) => void;
  onTrackingError?: (message: string) => void;
  onTrackingState?: (state: PresenterState | null) => void;
}

const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 720;

export function createDerivedVideoStreams(
  video: HTMLVideoElement,
  options: DerivedVideoStreamOptions,
): DerivedVideoStreams {
  const boardCanvas = outputCanvas();
  const speakerCanvas = outputCanvas();
  const boardContext = requireContext(boardCanvas);
  const speakerContext = requireContext(speakerCanvas);
  boardContext.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  speakerContext.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

  let active = true;
  let animationFrame = 0;
  let lastFrameAt: number | undefined;
  let presenterState = options.presenter
    ? initialPresenter(options.presenter)
    : null;
  let displayedPresenter = options.presenter;
  let targetPresenter = options.presenter;
  const detection =
    options.cameraUse === "room-wide"
      ? startPresenterDetection(video, undefined, {
          onBoxes(boxes) {
            options.onDetections?.(boxes);
            if (!presenterState) return;
            presenterState = updatePresenter(presenterState, boxes);
            if (presenterState.status === "tracking") {
              targetPresenter = presenterState.box;
            }
            options.onTrackingState?.(presenterState);
          },
          onError(message) {
            options.onTrackingError?.(message);
          },
        })
      : null;

  const renderSpeaker = (timestamp: number) => {
    if (!active) return;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (
        options.cameraUse === "room-wide" &&
        displayedPresenter &&
        targetPresenter
      ) {
        displayedPresenter = interpolatePresenterBox(
          displayedPresenter,
          targetPresenter,
          lastFrameAt === undefined ? 0 : timestamp - lastFrameAt,
        );
        drawPresenterCrop(speakerContext, video, displayedPresenter);
      } else {
        drawContainedVideo(speakerContext, video);
      }
      lastFrameAt = timestamp;
    }
    animationFrame = window.requestAnimationFrame(renderSpeaker);
  };
  animationFrame = window.requestAnimationFrame(renderSpeaker);
  const boardStream = boardCanvas.captureStream(10);
  const speakerStream = speakerCanvas.captureStream(24);

  return {
    board: boardStream,
    speaker: speakerStream,
    confirmPresenter(presenter) {
      if (options.cameraUse !== "room-wide") {
        throw new Error("A board-focused camera does not track a presenter.");
      }
      presenterState = initialPresenter(presenter);
      displayedPresenter = presenter;
      targetPresenter = presenter;
      options.onTrackingState?.(presenterState);
    },
    async updateBoard(imageUrl) {
      const image = new Image();
      image.src = imageUrl;
      await image.decode();
      if (active) drawContainedImage(boardContext, image);
    },
    stop() {
      if (!active) return;
      active = false;
      detection?.stop();
      window.cancelAnimationFrame(animationFrame);
      boardStream.getTracks().forEach((track) => track.stop());
      speakerStream.getTracks().forEach((track) => track.stop());
    },
  };
}

function initialPresenter(box: PersonBox): PresenterState {
  return { box, lossCount: 0, status: "tracking" };
}

function drawPresenterCrop(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  presenter: PersonBox,
) {
  const crop = presenterCrop(video.videoWidth, video.videoHeight, presenter);
  context.drawImage(
    video,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT,
  );
}

function drawContainedVideo(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
) {
  drawContained(context, video, video.videoWidth, video.videoHeight);
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
) {
  drawContained(context, image, image.naturalWidth, image.naturalHeight);
}

function drawContained(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
) {
  const scale = Math.min(
    OUTPUT_WIDTH / sourceWidth,
    OUTPUT_HEIGHT / sourceHeight,
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  context.drawImage(
    source,
    (OUTPUT_WIDTH - width) / 2,
    (OUTPUT_HEIGHT - height) / 2,
    width,
    height,
  );
}

function outputCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  return canvas;
}

function requireContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Video canvas processing is unavailable.");
  return context;
}
