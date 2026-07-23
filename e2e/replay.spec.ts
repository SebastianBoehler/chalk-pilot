import { rm } from "node:fs/promises";
import { join } from "node:path";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { installMediaFixture } from "./support/media-fixture";

const TRACKS = [
  "board",
  "speaker",
  "canvas",
  "microphone",
  "desktop-audio",
] as const;
const createdSessions = new Set<string>();

test.beforeEach(async ({ page }) => {
  await installMediaFixture(page, { height: 180, width: 320 });
});

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
});

test("switches synchronized views, seeks transcript, controls audio, and exports", async ({
  page,
  request,
}) => {
  const sessionId = await createRecording(request, TRACKS);
  await addTimeline(request, sessionId);
  await finalizeRecording(request, sessionId);

  await page.goto("/replay");
  const card = page.locator(`a[href="/replay/${sessionId}"]`);
  await expect(card).toBeVisible();
  await card.click();
  await expect(
    page.getByRole("heading", { name: "Session replay" }),
  ).toBeVisible();

  const canvas = page.getByTestId("track-canvas");
  await canvas.evaluate((media: HTMLMediaElement) => {
    media.currentTime = 4.2;
    media.dispatchEvent(new Event("timeupdate"));
  });
  await expect(page.getByText("0:04 / 0:08")).toBeVisible();
  await page.getByRole("button", { name: "Show board as primary" }).click();
  const board = page.getByTestId("track-board");
  await expect(board).toHaveClass(/inset-0/);
  await expect
    .poll(() => board.evaluate((media: HTMLMediaElement) => media.currentTime))
    .toBe(4.2);

  await page
    .getByRole("button", { name: /explain the board relationship/i })
    .click();
  await expect
    .poll(() => canvas.evaluate((media: HTMLMediaElement) => media.currentTime))
    .toBe(2);
  await expect(page.getByText("0:02 / 0:08")).toBeVisible();

  await page.getByRole("button", { name: "Mute Microphone" }).click();
  await page.getByLabel("Microphone volume").fill("0.35");
  await expect
    .poll(() =>
      page
        .getByTestId("track-microphone")
        .evaluate((media: HTMLMediaElement) => ({
          muted: media.muted,
          volume: media.volume,
        })),
    )
    .toEqual({ muted: true, volume: 0.35 });
  await expect
    .poll(() =>
      page
        .getByTestId("track-desktop-audio")
        .evaluate((media: HTMLMediaElement) => media.muted),
    )
    .toBe(false);

  for (const track of TRACKS) {
    await expect(
      page.getByRole("link", { name: `Download ${trackLabel(track)}` }),
    ).toBeVisible();
  }
  await assertDownload(
    page,
    page.getByRole("link", { name: "Download board" }),
  );
  await assertDownload(
    page,
    page.getByRole("link", { name: "Download session package" }),
  );
});

test("surfaces interrupted tracks while preserving recovered downloads", async ({
  page,
  request,
}) => {
  const sessionId = await createRecording(request, ["board"]);
  await finalizeRecording(request, sessionId);
  await page.goto(`/replay/${sessionId}`);

  await expect(
    page.getByRole("heading", {
      name: "Some recording evidence is incomplete",
    }),
  ).toBeVisible();
  await expect(page.getByText("Speaker: No chunks acknowledged")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download board" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download speaker" }),
  ).toHaveCount(0);
});

async function createRecording(
  request: APIRequestContext,
  tracks: readonly (typeof TRACKS)[number][],
) {
  const sessionResponse = await request.post("/api/sessions");
  expect(sessionResponse.ok()).toBe(true);
  const { id } = (await sessionResponse.json()) as { id: string };
  createdSessions.add(id);
  expect((await request.post(`/api/sessions/${id}/recording`)).status()).toBe(
    201,
  );
  for (const track of tracks) {
    const audio = track === "microphone" || track === "desktop-audio";
    const response = await request.put(
      `/api/sessions/${id}/recording/tracks/${track}/chunks/0`,
      {
        data: "chalkpilot-e2e",
        headers: {
          "content-type": `${audio ? "audio" : "video"}/webm`,
          "x-chalkpilot-duration-ms": "8000",
          "x-chalkpilot-offset-ms": "0",
        },
      },
    );
    expect(response.status()).toBe(204);
  }
  return id;
}

async function addTimeline(request: APIRequestContext, sessionId: string) {
  const url = `/api/sessions/${sessionId}/recording/timeline`;
  expect(
    (
      await request.post(url, {
        data: {
          endMs: 4_000,
          speaker: "user",
          startMs: 2_000,
          text: "Explain the board relationship.",
          type: "transcript",
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.post(url, {
        data: {
          offsetMs: 0,
          revision: { focusId: null, order: [], sections: {}, version: 1 },
          type: "canvas",
        },
      })
    ).status(),
  ).toBe(201);
}

async function finalizeRecording(
  request: APIRequestContext,
  sessionId: string,
) {
  const response = await request.post(
    `/api/sessions/${sessionId}/recording/finalize`,
    { data: { durationMs: 8_000 } },
  );
  expect(response.ok()).toBe(true);
}

async function assertDownload(page: Page, link: ReturnType<Page["getByRole"]>) {
  const pending = page.waitForEvent("download");
  await link.click();
  const download = await pending;
  expect(download.suggestedFilename()).not.toBe("");
  await download.cancel();
}

function trackLabel(track: (typeof TRACKS)[number]) {
  return track === "desktop-audio" ? "desktop audio" : track;
}
