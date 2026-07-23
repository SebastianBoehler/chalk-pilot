import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageRoot = join(root, "node_modules", "@mediapipe", "tasks-vision");
const vendorRoot = join(root, "public", "vendor", "mediapipe");
const wasmDestination = join(vendorRoot, "tasks-vision", "0.10.35", "wasm");
const modelDestination = join(
  vendorRoot,
  "models",
  "pose_landmarker_lite",
  "float16",
  "1",
  "pose_landmarker_lite.task",
);
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const modelHash =
  "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a";
const licenseHash =
  "8707eef0533987efc5b155d64761eeb6e20793f50b9bd1a68dad1cf4719d0ed8";
const wasmAssets = new Map([
  [
    "vision_wasm_internal.js",
    "e7fd9858e8e8f221d9b96eddc11f8e077f263e0b7bbd79d3cbe882b134274f8c",
  ],
  [
    "vision_wasm_internal.wasm",
    "6a5c64584c2ab61c763b6e204afbdbc7ce1caf7f5216187322bca8df94f646bc",
  ],
  [
    "vision_wasm_module_internal.js",
    "1f1d6215324a1fe62f6742d49a3db911170987ca18ad8c1b75f1a1c82acf2b44",
  ],
  [
    "vision_wasm_module_internal.wasm",
    "617b8e0248dbd27e9d7ece4218004eae4cefb499196d1bb4fa0e3fef21708756",
  ],
  [
    "vision_wasm_nosimd_internal.js",
    "438d1fe8ff7f4d946025bc211c291543c037d8a3785ed4eee60f1f521b236296",
  ],
  [
    "vision_wasm_nosimd_internal.wasm",
    "8a3092d34c79d3f57e6ba8592105e8a90f6b07c27891ffecd14cca428bfd3e31",
  ],
]);

await assertPackageVersion();
await mkdir(wasmDestination, { recursive: true });
for (const [name, hash] of wasmAssets) {
  const source = join(packageRoot, "wasm", name);
  const destination = join(wasmDestination, name);
  await assertHash(source, hash);
  await copyFile(source, destination);
  await assertHash(destination, hash);
}
await copyPinnedLicense();
await ensureModel();
process.stdout.write("Prepared pinned MediaPipe assets in public/vendor.\n");

async function assertPackageVersion() {
  const manifestPath = join(packageRoot, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.version !== "0.10.35") {
    throw new Error(
      `Expected @mediapipe/tasks-vision@0.10.35, found ${manifest.version}.`,
    );
  }
}

async function copyPinnedLicense() {
  const source = join(root, "third_party", "mediapipe", "LICENSE.txt");
  const destination = join(vendorRoot, "LICENSE.txt");
  await assertHash(source, licenseHash);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  await assertHash(destination, licenseHash);
}

async function ensureModel() {
  if (await hasHash(modelDestination, modelHash)) {
    return;
  }

  await mkdir(dirname(modelDestination), { recursive: true });
  const temporary = `${modelDestination}.download-${process.pid}`;
  try {
    const response = await fetch(modelUrl);
    if (!response.ok) {
      throw new Error(
        `Model download failed: ${response.status} ${response.statusText}.`,
      );
    }
    await writeFile(temporary, new Uint8Array(await response.arrayBuffer()));
    await assertHash(temporary, modelHash);
    await rm(modelDestination, { force: true });
    await rename(temporary, modelDestination);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function hasHash(path, expectedHash) {
  try {
    await assertHash(path, expectedHash);
    return true;
  } catch {
    return false;
  }
}

async function assertHash(path, expectedHash) {
  const contents = await readFile(path);
  const actualHash = createHash("sha256").update(contents).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(
      `Checksum mismatch for ${path}: expected ${expectedHash}, found ${actualHash}.`,
    );
  }
}
