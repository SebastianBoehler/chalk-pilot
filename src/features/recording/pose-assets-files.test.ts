import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const assets = [
  [
    "public/vendor/mediapipe/LICENSE.txt",
    12_331,
    "8707eef0533987efc5b155d64761eeb6e20793f50b9bd1a68dad1cf4719d0ed8",
  ],
  [
    "public/vendor/mediapipe/tasks-vision/0.10.35/wasm/vision_wasm_internal.js",
    322_044,
    "e7fd9858e8e8f221d9b96eddc11f8e077f263e0b7bbd79d3cbe882b134274f8c",
  ],
  [
    "public/vendor/mediapipe/tasks-vision/0.10.35/wasm/vision_wasm_internal.wasm",
    11_153_617,
    "6a5c64584c2ab61c763b6e204afbdbc7ce1caf7f5216187322bca8df94f646bc",
  ],
  [
    "public/vendor/mediapipe/tasks-vision/0.10.35/wasm/vision_wasm_module_internal.js",
    322_082,
    "1f1d6215324a1fe62f6742d49a3db911170987ca18ad8c1b75f1a1c82acf2b44",
  ],
  [
    "public/vendor/mediapipe/tasks-vision/0.10.35/wasm/vision_wasm_module_internal.wasm",
    11_153_641,
    "617b8e0248dbd27e9d7ece4218004eae4cefb499196d1bb4fa0e3fef21708756",
  ],
  [
    "public/vendor/mediapipe/tasks-vision/0.10.35/wasm/vision_wasm_nosimd_internal.js",
    321_847,
    "438d1fe8ff7f4d946025bc211c291543c037d8a3785ed4eee60f1f521b236296",
  ],
  [
    "public/vendor/mediapipe/tasks-vision/0.10.35/wasm/vision_wasm_nosimd_internal.wasm",
    10_481_398,
    "8a3092d34c79d3f57e6ba8592105e8a90f6b07c27891ffecd14cca428bfd3e31",
  ],
  [
    "public/vendor/mediapipe/models/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    5_777_746,
    "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a",
  ],
] as const;

describe("prepared pose assets", () => {
  it.each(assets)("pins %s by byte length and SHA-256", (path, bytes, hash) => {
    const contents = readFileSync(path);

    expect(contents.byteLength).toBe(bytes);
    expect(createHash("sha256").update(contents).digest("hex")).toBe(hash);
  });
});
