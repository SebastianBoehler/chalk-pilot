import { rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  installDisplayCaptureFixture,
  installMediaFixture,
  stubRealtime,
} from "./support/media-fixture";

const createdSessions = new Set<string>();
const createdStudyPacks = new Set<string>();
const TRACKS = [
  "board",
  "speaker",
  "canvas",
  "microphone",
  "desktop-audio",
] as const;

test.afterEach(async () => {
  await Promise.all(
    [...createdSessions].map((sessionId) =>
      rm(join(process.cwd(), ".chalkpilot", "sessions", sessionId), {
        force: true,
        recursive: true,
      }),
    ),
  );
  createdSessions.clear();
  await Promise.all(
    [...createdStudyPacks].map((packId) =>
      rm(join(process.cwd(), ".chalkpilot", "study-packs", packId), {
        force: true,
        recursive: true,
      }),
    ),
  );
  createdStudyPacks.clear();
});

test("uses the live camera aspect and skips presenter tracking at home", async ({
  page,
}) => {
  await installMediaFixture(page, { height: 200, width: 320 });
  await stubRealtime(page);
  await openCamera(page);
  await confirmMicrophone(page);

  const frame = calibrationSurface(page);
  await expect
    .poll(() => frame.evaluate((element) => element.clientWidth > 0))
    .toBe(true);
  await expect.poll(() => aspectRatio(frame)).toBeCloseTo(1.6, 2);

  await page.evaluate(() => {
    const size = (
      window as unknown as Window & {
        __chalkPilotVideoSize: { height: number; width: number };
      }
    ).__chalkPilotVideoSize;
    size.height = 180;
    document.querySelector("video")?.dispatchEvent(new Event("resize"));
  });
  await expect.poll(() => aspectRatio(frame)).toBeCloseTo(16 / 9, 2);

  await confirmBoard(page);
  await expect(page.getByLabel("Full fixed camera")).toBeVisible();
  await expect(page.getByLabel("Corrected board video")).toBeVisible();
  await expect(page.getByLabel("Speaker video")).toBeVisible();
  await expect(page.getByText(/click yourself/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Outputs look right" }).click();
  await expect(
    page.getByRole("button", { name: "Start learning session" }),
  ).toBeEnabled();
});

test("requires presenter confirmation for a room-wide camera", async ({
  page,
}) => {
  await installMediaFixture(page, {
    height: 180,
    poseBoxes: [{ height: 0.75, id: "presenter", width: 0.3, x: 0.25, y: 0.1 }],
    width: 320,
  });
  await stubRealtime(page);
  await openCamera(page, { trackPresenter: true });
  await confirmMicrophone(page);
  await confirmBoard(page);

  const continueButton = page.getByRole("button", {
    name: "Outputs look right",
  });
  await expect(continueButton).toBeDisabled();
  const selector = page.getByRole("button", {
    name: "Select presenter from full camera",
  });
  await expect(page.getByText("Click your outline to confirm")).toBeVisible();
  const bounds = await selector.boundingBox();
  if (!bounds) throw new Error("Presenter selection surface is unavailable.");
  await selector.click({
    position: { x: bounds.width * 0.4, y: bounds.height * 0.5 },
  });
  await expect(page.getByText("Presenter confirmed")).toBeVisible();
  await expect(continueButton).toBeEnabled();
});

test("keeps five-track recording alive across sidebar collapse and opens replay", async ({
  page,
}) => {
  await installMediaFixture(page, { height: 180, width: 320 });
  await installDisplayCaptureFixture(page);
  await stubRealtime(page);
  await openCamera(page);
  await confirmMicrophone(page);
  await confirmBoard(page);
  await page.getByRole("button", { name: "Outputs look right" }).click();

  const sessionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/sessions") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Start learning session" }).click();
  const session = (await (await sessionResponse).json()) as { id: string };
  createdSessions.add(session.id);
  await expect(
    page.getByRole("heading", { name: "Learning canvas" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Start session recording" }).click();
  await expect(page.getByText(/^Recording ·/)).toBeVisible();
  await page.request.post(`/api/sessions/${session.id}/recording/timeline`, {
    data: {
      endMs: 4_000,
      speaker: "user",
      startMs: 2_000,
      text: "Explain the board relationship.",
      type: "transcript",
    },
  });

  await page.getByRole("button", { name: "Hide session controls" }).click();
  await page.waitForTimeout(550);
  await page.getByRole("button", { name: "Show session controls" }).click();
  await expect(page.getByText(/^Recording ·/)).toBeVisible();
  await page.getByRole("button", { name: "Stop recording" }).click();
  const replay = page.getByRole("link", { name: "Open replay" });
  await expect(replay).toBeVisible();

  const manifestResponse = await page.request.get(
    `/api/sessions/${session.id}/recording`,
  );
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as {
    state: string;
    tracks: Record<
      string,
      {
        acknowledgedSequences: number[];
        byteSize: number;
        health: string;
      }
    >;
  };
  expect(manifest.state).toBe("complete");
  expect(Object.keys(manifest.tracks).sort()).toEqual([...TRACKS].sort());
  for (const track of TRACKS) {
    expect(manifest.tracks[track]).toMatchObject({
      acknowledgedSequences: [0],
      health: "complete",
    });
    expect(manifest.tracks[track].byteSize).toBeGreaterThan(0);
  }

  await replay.click();

  await expect(page).toHaveURL(new RegExp(`/replay/${session.id}$`));
  await expect(
    page.getByRole("heading", { name: "Replay Studio" }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Downloads" })
    .getByText("Downloads")
    .click();
  for (const track of TRACKS) {
    await expect(
      page.getByRole("link", {
        name: `Download ${track === "desktop-audio" ? "desktop audio" : track}`,
      }),
    ).toBeVisible();
  }
});

test("explains denied camera permission", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied for test", "NotAllowedError");
    };
  });
  await page.goto("/setup");
  await page.getByRole("button", { name: "Continue without material" }).click();
  await page.getByRole("button", { name: "Allow camera" }).click();
  await expect(page.getByText("Camera unavailable")).toBeVisible();
  await expect(page.getByText(/permission was denied/i)).toBeVisible();
});

test("uploads a reusable study pack and grounds the created session", async ({
  page,
}) => {
  await installMediaFixture(page, { height: 180, width: 320 });
  await stubRealtime(page);
  await page.goto("/setup");
  const packResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/study-packs") &&
      response.request().method() === "POST",
  );
  await page.getByLabel("New study pack").fill("Information geometry");
  await page.getByRole("button", { name: "Create study pack" }).click();
  const pack = (await (await packResponse).json()) as { id: string };
  createdStudyPacks.add(pack.id);

  await page.getByLabel("Add files").setInputFiles({
    name: "distinctive-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Start with a smooth statistical manifold.\n\n" +
        "The heliotrope manifold criterion is the distinctive course phrase.",
    ),
  });
  await expect(page.getByText("distinctive-notes.txt")).toBeVisible();
  await page.getByRole("button", { name: "Continue with study pack" }).click();
  await allowCamera(page);
  await confirmMicrophone(page);
  await confirmBoard(page);
  await page.getByRole("button", { name: "Outputs look right" }).click();

  const sessionResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/sessions") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Start learning session" }).click();
  const session = (await (await sessionResponse).json()) as {
    id: string;
    studyPackId: string;
  };
  createdSessions.add(session.id);
  expect(session.studyPackId).toBe(pack.id);

  const search = await page.request.post(
    `/api/sessions/${session.id}/study-pack/search`,
    { data: { query: "heliotrope manifold" } },
  );
  expect(search.ok()).toBe(true);
  const searchResult = (await search.json()) as {
    results: Array<{ sourceTitle: string; locator: string }>;
  };
  expect(searchResult.results[0]).toMatchObject({
    sourceTitle: "distinctive-notes",
    locator: "Paragraph 2",
  });
});

async function openCamera(
  page: Page,
  options: { trackPresenter?: boolean } = {},
) {
  await page.goto("/setup");
  await page.getByRole("button", { name: "Continue without material" }).click();
  await allowCamera(page, options);
}

async function allowCamera(
  page: Page,
  options: { trackPresenter?: boolean } = {},
) {
  if (options.trackPresenter) {
    await page.getByRole("checkbox", { name: /track a presenter/i }).check();
  }
  await page.getByRole("button", { name: "Allow camera" }).click();
  await expect(page.locator("#camera-device")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
}

async function confirmMicrophone(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Check the room microphone" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.locator("#microphone-device")).toBeVisible();
  await page.getByRole("button", { name: "Confirm microphone" }).click();
}

async function confirmBoard(page: Page) {
  const confirm = page.getByRole("button", { name: "Use this board frame" });
  await expect(confirm).toBeEnabled({ timeout: 15_000 });
  await confirm.click();
}

function calibrationSurface(page: Page) {
  return page
    .getByAltText("Camera view for board calibration")
    .locator("xpath=..");
}

async function aspectRatio(locator: ReturnType<typeof calibrationSurface>) {
  return locator.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).aspectRatio),
  );
}
