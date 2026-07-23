import { grayscaleSample } from "@/features/board/frame";
import { updateSpeakerTarget, type SpeakerTarget } from "./speaker-tracker";

export interface DerivedVideoStreams {
  board: MediaStream;
  speaker: MediaStream;
  updateBoard(imageUrl: string): Promise<void>;
  stop(): void;
}

const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 720;
const SAMPLE_WIDTH = 160;
const SAMPLE_HEIGHT = 90;

export function createDerivedVideoStreams(
  video: HTMLVideoElement,
): DerivedVideoStreams {
  const boardCanvas = outputCanvas();
  const speakerCanvas = outputCanvas();
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = SAMPLE_WIDTH;
  sampleCanvas.height = SAMPLE_HEIGHT;
  const boardContext = requireContext(boardCanvas);
  const speakerContext = requireContext(speakerCanvas);
  const sampleContext = requireContext(sampleCanvas, true);
  boardContext.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  speakerContext.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

  let active = true;
  let animationFrame = 0;
  let frameNumber = 0;
  let previousSample: Uint8Array | null = null;
  let target: SpeakerTarget = { x: 0.5, y: 0.5 };

  const renderSpeaker = () => {
    if (!active) return;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (frameNumber % 6 === 0) {
        sampleContext.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
        const image = sampleContext.getImageData(
          0,
          0,
          SAMPLE_WIDTH,
          SAMPLE_HEIGHT,
        );
        const current = grayscaleSample(image, SAMPLE_WIDTH, SAMPLE_HEIGHT);
        if (previousSample) {
          target = updateSpeakerTarget(
            previousSample,
            current,
            SAMPLE_WIDTH,
            SAMPLE_HEIGHT,
            target,
          );
        }
        previousSample = current;
      }
      const crop = speakerCrop(video.videoWidth, video.videoHeight, target);
      speakerContext.drawImage(
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
      frameNumber += 1;
    }
    animationFrame = window.requestAnimationFrame(renderSpeaker);
  };
  animationFrame = window.requestAnimationFrame(renderSpeaker);
  const boardStream = boardCanvas.captureStream(10);
  const speakerStream = speakerCanvas.captureStream(24);

  return {
    board: boardStream,
    speaker: speakerStream,
    async updateBoard(imageUrl) {
      const image = new Image();
      image.src = imageUrl;
      await image.decode();
      if (!active) return;
      drawContained(boardContext, image);
    },
    stop() {
      active = false;
      window.cancelAnimationFrame(animationFrame);
      boardStream.getTracks().forEach((track) => track.stop());
      speakerStream.getTracks().forEach((track) => track.stop());
    },
  };
}

function outputCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  return canvas;
}

function requireContext(canvas: HTMLCanvasElement, frequent = false) {
  const context = canvas.getContext("2d", {
    willReadFrequently: frequent,
  });
  if (!context) throw new Error("Video canvas processing is unavailable.");
  return context;
}

function speakerCrop(width: number, height: number, target: SpeakerTarget) {
  const cropWidth = Math.min(width, Math.round(width * 0.45));
  const cropHeight = Math.min(height, Math.round((cropWidth * 9) / 16));
  return {
    x: clamp(
      Math.round(target.x * width - cropWidth / 2),
      0,
      width - cropWidth,
    ),
    y: clamp(
      Math.round(target.y * height - cropHeight / 2),
      0,
      height - cropHeight,
    ),
    width: cropWidth,
    height: cropHeight,
  };
}

function drawContained(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
) {
  const scale = Math.min(
    OUTPUT_WIDTH / image.naturalWidth,
    OUTPUT_HEIGHT / image.naturalHeight,
  );
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  context.drawImage(
    image,
    (OUTPUT_WIDTH - width) / 2,
    (OUTPUT_HEIGHT - height) / 2,
    width,
    height,
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
