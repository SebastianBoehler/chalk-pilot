/// <reference lib="webworker" />

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { poseLandmarksToBoxes } from "./pose-landmarks";

interface DetectRequest {
  id: string;
  type: "detect";
  frame: ImageBitmap;
  timestampMs: number;
}

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let landmarkerPromise: Promise<PoseLandmarker> | undefined;

self.onmessage = (event: MessageEvent<DetectRequest>) => {
  void detect(event.data);
};

async function detect(request: DetectRequest) {
  try {
    const landmarker = await getLandmarker();
    const result = landmarker.detectForVideo(
      request.frame,
      request.timestampMs,
    );
    self.postMessage({
      boxes: poseLandmarksToBoxes(result.landmarks),
      id: request.id,
      ok: true,
    });
  } catch (cause) {
    self.postMessage({
      error:
        cause instanceof Error
          ? cause.message
          : "The presenter model could not process this frame.",
      id: request.id,
      ok: false,
    });
  } finally {
    request.frame.close();
  }
}

function getLandmarker() {
  landmarkerPromise ??= FilesetResolver.forVisionTasks(WASM_URL).then(
    (fileset) =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL },
        minPoseDetectionConfidence: 0.45,
        minPosePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
        numPoses: 4,
        outputSegmentationMasks: false,
        runningMode: "VIDEO",
      }),
  );
  return landmarkerPromise;
}
