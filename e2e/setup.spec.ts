import { expect, test } from "@playwright/test";

test("walks from camera permission to the room-readiness gate", async ({
  page,
}) => {
  await page.goto("/setup");
  await expect(
    page.getByRole("heading", { name: "Connect the room camera" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Allow camera" }).click();
  await expect(page.getByLabel("Camera")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Frame the board" }),
  ).toBeVisible();
  const confirmFrame = page.getByRole("button", {
    name: "Use this board frame",
  });
  await expect(confirmFrame).toBeEnabled({ timeout: 45_000 });
  await confirmFrame.click();

  await expect(
    page.getByRole("heading", { name: "Check the output streams" }),
  ).toBeVisible();
  await expect(page.getByLabel("Full room camera")).toBeVisible();
  await expect(page.getByLabel("Corrected board video")).toBeVisible();
  await expect(page.getByLabel("Tracked speaker video")).toBeVisible();
  await page.getByRole("button", { name: "Outputs look right" }).click();

  await expect(
    page.getByRole("heading", { name: "Ready for the board" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start learning session" }),
  ).toBeDisabled();
});

test("explains denied camera permission", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied for test", "NotAllowedError");
    };
  });
  await page.goto("/setup");

  await page.getByRole("button", { name: "Allow camera" }).click();

  await expect(page.getByText("Camera unavailable")).toBeVisible();
  await expect(page.getByText(/permission was denied/i)).toBeVisible();
});

test("keeps the camera video live after entering the learning session", async ({
  page,
}) => {
  await page.route("**/api/realtime-token", async (route) => {
    await route.fulfill({
      json:
        route.request().method() === "GET"
          ? { configured: true }
          : { value: "ek_test_secret" },
    });
  });
  await page.goto("/setup");
  await page.getByRole("button", { name: "Allow camera" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const confirmFrame = page.getByRole("button", {
    name: "Use this board frame",
  });
  await expect(confirmFrame).toBeEnabled({ timeout: 45_000 });
  await confirmFrame.click();
  await page.getByRole("button", { name: "Outputs look right" }).click();

  await page.getByRole("button", { name: "Start learning session" }).click();

  await expect(
    page.getByRole("heading", { name: "Learning canvas" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.locator("video").evaluate((video: HTMLVideoElement) => ({
        hasStream: video.srcObject !== null,
        paused: video.paused,
      })),
    )
    .toEqual({ hasStream: true, paused: false });
});

test("records board, tracked speaker, and canvas as separate videos", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: () =>
        navigator.mediaDevices.getUserMedia({ audio: false, video: true }),
    });
  });
  await page.route("**/api/realtime-token", async (route) => {
    await route.fulfill({
      json:
        route.request().method() === "GET"
          ? { configured: true }
          : { value: "ek_test_secret" },
    });
  });
  await page.goto("/setup");
  await page.getByRole("button", { name: "Allow camera" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  const confirmFrame = page.getByRole("button", {
    name: "Use this board frame",
  });
  await expect(confirmFrame).toBeEnabled({ timeout: 45_000 });
  await confirmFrame.click();
  await page.getByRole("button", { name: "Outputs look right" }).click();
  await page.getByRole("button", { name: "Start learning session" }).click();
  await page.getByRole("button", { name: "Start 3 recordings" }).click();

  await expect(page.getByText("Recording 3 videos")).toBeVisible();
  await page.getByRole("button", { name: "Hide session controls" }).click();
  await page.getByRole("button", { name: "Show session controls" }).click();
  await expect(page.getByText("Recording 3 videos")).toBeVisible();
  await page.getByRole("button", { name: "Stop recording" }).click();

  await expect(
    page.getByRole("link", { name: "Download board" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download speaker" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download canvas" }),
  ).toBeVisible();
});
