# Third-party runtime assets

ChalkPilot serves the presenter-tracking runtime from `public/vendor` so a
session never depends on a runtime CDN fetch. The generated directory is
gitignored to keep the repository lean.

`npm install` and `npm run build` run
`scripts/prepare-mediapipe-assets.mjs`. The script copies the pinned WASM
runtime from the installed npm package, downloads the pinned model only when
it is missing or invalid, and verifies every checksum. Preparation fails
explicitly when a package, download, license, or checksum is wrong.

## MediaPipe Tasks Vision 0.10.35

- Package: `@mediapipe/tasks-vision@0.10.35`
- Upstream: <https://github.com/google-ai-edge/mediapipe/tree/v0.10.35>
- License: Apache-2.0
- Tracked license copy: `third_party/mediapipe/LICENSE.txt`
- Runtime license copy: generated at `public/vendor/mediapipe/LICENSE.txt`
- Provenance: the six WASM loader/runtime files were copied verbatim from
  `node_modules/@mediapipe/tasks-vision/wasm` after a clean package install.

## Pose Landmarker Lite float16 model

- Model:
  `pose_landmarker_lite/float16/1/pose_landmarker_lite.task`
- Upstream:
  <https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task>
- Project and license: MediaPipe, Apache-2.0; see the vendored license copy
  above.
- Prepared model size: 5,777,746 bytes.
- Total prepared runtime size excluding the generated license copy:
  39,532,375 bytes.

## SHA-256 checksums

| File                               |      Bytes | SHA-256                                                            |
| ---------------------------------- | ---------: | ------------------------------------------------------------------ |
| `LICENSE.txt`                      |     12,331 | `8707eef0533987efc5b155d64761eeb6e20793f50b9bd1a68dad1cf4719d0ed8` |
| `vision_wasm_internal.js`          |    322,044 | `e7fd9858e8e8f221d9b96eddc11f8e077f263e0b7bbd79d3cbe882b134274f8c` |
| `vision_wasm_internal.wasm`        | 11,153,617 | `6a5c64584c2ab61c763b6e204afbdbc7ce1caf7f5216187322bca8df94f646bc` |
| `vision_wasm_module_internal.js`   |    322,082 | `1f1d6215324a1fe62f6742d49a3db911170987ca18ad8c1b75f1a1c82acf2b44` |
| `vision_wasm_module_internal.wasm` | 11,153,641 | `617b8e0248dbd27e9d7ece4218004eae4cefb499196d1bb4fa0e3fef21708756` |
| `vision_wasm_nosimd_internal.js`   |    321,847 | `438d1fe8ff7f4d946025bc211c291543c037d8a3785ed4eee60f1f521b236296` |
| `vision_wasm_nosimd_internal.wasm` | 10,481,398 | `8a3092d34c79d3f57e6ba8592105e8a90f6b07c27891ffecd14cca428bfd3e31` |
| `pose_landmarker_lite.task`        |  5,777,746 | `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a` |
