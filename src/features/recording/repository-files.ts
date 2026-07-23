import { randomUUID } from "node:crypto";
import { open, readFile, rename, rm, type FileHandle } from "node:fs/promises";
import { dirname } from "node:path";

async function syncAndClose(handle: FileHandle) {
  await handle.sync();
  await handle.close();
}

export async function atomicWriteJson(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  let handle: FileHandle | undefined;
  try {
    handle = await open(temporary, "wx");
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await syncAndClose(handle);
    handle = undefined;
    await rename(temporary, path);
  } finally {
    await handle?.close();
    await rm(temporary, { force: true });
  }
}

export async function writeManifest(path: string, value: unknown) {
  await atomicWriteJson(path, value);
  await syncDirectory(path);
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function writeDurableBytes(path: string, bytes: Uint8Array) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  let handle: FileHandle | undefined;
  try {
    handle = await open(temporary, "wx");
    await handle.writeFile(bytes);
    await syncAndClose(handle);
    handle = undefined;
    await rename(temporary, path);
  } finally {
    await handle?.close();
    await rm(temporary, { force: true });
  }
}

export async function combineDurableFiles(
  sources: string[],
  destination: string,
) {
  const temporary = `${destination}.${randomUUID()}.tmp`;
  let handle: FileHandle | undefined;
  try {
    handle = await open(temporary, "wx");
    for (const source of sources) {
      await handle.write(await readFile(source));
    }
    await syncAndClose(handle);
    handle = undefined;
    await rename(temporary, destination);
  } finally {
    await handle?.close();
    await rm(temporary, { force: true });
  }
}

export async function syncDirectory(path: string) {
  const handle = await open(dirname(path), "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
