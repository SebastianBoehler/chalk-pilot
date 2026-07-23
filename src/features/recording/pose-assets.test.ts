import { describe, expect, it } from "vitest";
import { MEDIAPIPE_WASM_PATH, POSE_LANDMARKER_MODEL_PATH } from "./pose-assets";

describe("pose assets", () => {
  it("loads the pinned runtime and model from same-origin public paths", () => {
    expect(MEDIAPIPE_WASM_PATH).toBe(
      "/vendor/mediapipe/tasks-vision/0.10.35/wasm",
    );
    expect(POSE_LANDMARKER_MODEL_PATH).toBe(
      "/vendor/mediapipe/models/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    );
    expect(`${MEDIAPIPE_WASM_PATH}${POSE_LANDMARKER_MODEL_PATH}`).not.toMatch(
      /https?:\/\//,
    );
  });
});
