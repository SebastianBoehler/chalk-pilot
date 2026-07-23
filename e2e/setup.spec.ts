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
    page.getByRole("heading", { name: "Open the learning canvas" }),
  ).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open presentation window" }).click();
  const display = await popupPromise;
  await expect(
    display.getByRole("heading", { name: "Start at the board." }),
  ).toBeVisible();
  await expect(page.getByText("Canvas connected")).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
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
