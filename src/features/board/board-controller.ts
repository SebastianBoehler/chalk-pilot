import {
  advanceBoardChange,
  initialBoardChangeState,
  markBoardSent,
  measureBoardChange,
  type BoardChangeState,
} from "./change-detector";
import { captureVideoFrame, grayscaleSample, imageDataUrl } from "./frame";
import type { BoardCorners, DetectionResult } from "./types";

export interface BoardProcessor {
  detect(image: ImageData): Promise<DetectionResult>;
  warp(image: ImageData, corners: BoardCorners): Promise<ImageData>;
  dispose(): void;
}

interface BoardDependencies {
  capture(video: HTMLVideoElement): ImageData;
  encode(image: ImageData): string;
  sample(image: ImageData): Uint8Array;
}

export interface BoardCalibration {
  corners: BoardCorners;
  sourceUrl: string;
  rectifiedUrl: string;
  autoDetected: boolean;
}

const DEFAULT_CORNERS: BoardCorners = [
  { x: 0.05, y: 0.05 },
  { x: 0.95, y: 0.05 },
  { x: 0.95, y: 0.95 },
  { x: 0.05, y: 0.95 },
];

export class BoardController {
  private readonly dependencies: BoardDependencies;
  private sourceFrame: ImageData | null = null;
  private latestImage: string | null = null;
  private latestSample: Uint8Array | null = null;
  private sentSample: Uint8Array | null = null;
  private changeState: BoardChangeState = initialBoardChangeState;

  constructor(
    private readonly processor: BoardProcessor,
    dependencies: Partial<BoardDependencies> = {},
  ) {
    this.dependencies = {
      capture: dependencies.capture ?? captureVideoFrame,
      encode: dependencies.encode ?? imageDataUrl,
      sample: dependencies.sample ?? grayscaleSample,
    };
  }

  async detect(video: HTMLVideoElement): Promise<BoardCalibration> {
    const frame = this.dependencies.capture(video);
    this.sourceFrame = frame;
    const detection = await this.processor.detect(frame);
    const corners = detection.corners ?? DEFAULT_CORNERS;
    const rectifiedUrl = await this.rectifySource(corners);
    return {
      corners,
      sourceUrl: this.dependencies.encode(frame),
      rectifiedUrl,
      autoDetected: detection.corners !== null,
    };
  }

  async updateCorners(corners: BoardCorners): Promise<string> {
    if (!this.sourceFrame) {
      throw new Error("Capture a camera frame before adjusting the board.");
    }
    return this.rectifySource(corners);
  }

  async sample(
    video: HTMLVideoElement,
    corners: BoardCorners,
  ): Promise<string> {
    const corrected = await this.processor.warp(
      this.dependencies.capture(video),
      corners,
    );
    this.latestImage = this.dependencies.encode(corrected);
    this.latestSample = this.dependencies.sample(corrected);
    if (this.sentSample) {
      this.changeState = advanceBoardChange(
        this.changeState,
        measureBoardChange(this.sentSample, this.latestSample),
      );
    }
    return this.latestImage;
  }

  hasMaterialChange(): boolean {
    return Boolean(
      this.latestImage && (!this.sentSample || this.changeState.dirty),
    );
  }

  getLatestImage(): string | null {
    return this.latestImage;
  }

  markSent(): void {
    this.sentSample = this.latestSample?.slice() ?? null;
    this.changeState = markBoardSent(this.changeState);
  }

  dispose(): void {
    this.processor.dispose();
  }

  private async rectifySource(corners: BoardCorners): Promise<string> {
    const corrected = await this.processor.warp(this.sourceFrame!, corners);
    this.latestImage = this.dependencies.encode(corrected);
    this.latestSample = this.dependencies.sample(corrected);
    return this.latestImage;
  }
}
