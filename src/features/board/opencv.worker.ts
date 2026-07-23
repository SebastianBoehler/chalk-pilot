/// <reference lib="webworker" />

import cvModule from "@techstark/opencv-js";
import { orderCorners, outputBoardSize } from "./geometry";
import type { BoardCorners, DetectionResult, NormalizedPoint } from "./types";

type OpenCv = typeof import("@techstark/opencv-js");
type OpenCvCandidate = OpenCv & {
  Mat?: OpenCv["Mat"];
  onRuntimeInitialized?: () => void;
};

type WorkerRequest =
  | { id: string; type: "detect"; image: ImageData }
  | { id: string; type: "warp"; image: ImageData; corners: BoardCorners };

let openCvPromise: Promise<OpenCv> | undefined;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void handleRequest(event.data);
};

async function handleRequest(request: WorkerRequest) {
  try {
    const cv = await getOpenCv();
    const result =
      request.type === "detect"
        ? detectBoard(cv, request.image)
        : warpBoard(cv, request.image, request.corners);
    const transfer = result instanceof ImageData ? [result.data.buffer] : [];
    self.postMessage({ id: request.id, ok: true, result }, { transfer });
  } catch (error) {
    self.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : "Board processing failed",
    });
  }
}

function getOpenCv(): Promise<OpenCv> {
  openCvPromise ??= (async () => {
    const candidate = cvModule as OpenCvCandidate | Promise<OpenCv>;
    if (candidate instanceof Promise) return candidate;
    if (candidate.Mat) return candidate;
    await new Promise<void>((resolve) => {
      candidate.onRuntimeInitialized = resolve;
    });
    return candidate;
  })();
  return openCvPromise;
}

function detectBoard(cv: OpenCv, image: ImageData): DetectionResult {
  const source = cv.matFromImageData(image);
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  let best: BoardCorners | null = null;
  let bestArea = 0;
  try {
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
    cv.Canny(blurred, edges, 50, 160);
    cv.findContours(
      edges,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE,
    );
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      const approximation = new cv.Mat();
      try {
        const area = Math.abs(cv.contourArea(contour));
        if (area <= bestArea || area < image.width * image.height * 0.08)
          continue;
        cv.approxPolyDP(
          contour,
          approximation,
          cv.arcLength(contour, true) * 0.02,
          true,
        );
        if (approximation.rows !== 4 || !cv.isContourConvex(approximation))
          continue;
        const points: NormalizedPoint[] = [];
        for (let point = 0; point < 4; point += 1) {
          points.push({
            x: approximation.data32S[point * 2] / image.width,
            y: approximation.data32S[point * 2 + 1] / image.height,
          });
        }
        best = orderCorners(points);
        bestArea = area;
      } finally {
        approximation.delete();
        contour.delete();
      }
    }
    return {
      corners: best,
      confidence: best
        ? Math.min(1, bestArea / (image.width * image.height))
        : 0,
    };
  } finally {
    source.delete();
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
}

function warpBoard(
  cv: OpenCv,
  image: ImageData,
  corners: BoardCorners,
): ImageData {
  const ordered = orderCorners(corners);
  const size = outputBoardSize(ordered, image.width, image.height);
  const source = cv.matFromImageData(image);
  const destination = new cv.Mat();
  const sourcePoints = cv.matFromArray(
    4,
    1,
    cv.CV_32FC2,
    ordered.flatMap(({ x, y }) => [x * image.width, y * image.height]),
  );
  const destinationPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    size.width,
    0,
    size.width,
    size.height,
    0,
    size.height,
  ]);
  const transform = cv.getPerspectiveTransform(sourcePoints, destinationPoints);
  try {
    cv.warpPerspective(
      source,
      destination,
      transform,
      new cv.Size(size.width, size.height),
      cv.INTER_LINEAR,
    );
    return new ImageData(
      new Uint8ClampedArray(destination.data),
      destination.cols,
      destination.rows,
    );
  } finally {
    source.delete();
    destination.delete();
    sourcePoints.delete();
    destinationPoints.delete();
    transform.delete();
  }
}
