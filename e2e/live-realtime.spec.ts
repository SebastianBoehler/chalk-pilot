import { expect, test } from "@playwright/test";

test.skip(
  process.env.RUN_LIVE_OPENAI !== "1",
  "Set RUN_LIVE_OPENAI=1 and OPENAI_API_KEY for the live smoke test.",
);

test("submits a board image and lets the live agent update the display", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/setup");
  await page.getByRole("radio", { name: /board-focused camera/i }).check();
  await page.getByRole("button", { name: "Allow camera" }).click();
  await expect(page.locator("#camera-device")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.locator("#microphone-device")).toBeVisible();
  await page.getByRole("button", { name: "Confirm microphone" }).click();

  const confirmFrame = page.getByRole("button", {
    name: "Use this board frame",
  });
  await expect(confirmFrame).toBeEnabled({ timeout: 45_000 });
  await confirmFrame.click();
  await page.getByRole("button", { name: "Outputs look right" }).click();

  const start = page.getByRole("button", {
    name: "Start learning session",
  });
  await expect(start).toBeEnabled();
  await start.click();
  await expect(
    page.getByRole("heading", { name: "Learning canvas" }),
  ).toBeVisible();
  await expect(page.getByText("listening", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByRole("button", { name: "Inspect board now" }).click();
  await expect(
    page.getByText("Corrected board shared with the learning partner."),
  ).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open clean display" }).click();
  const display = await popupPromise;

  const sessionCanvas = page
    .getByRole("heading", { name: "Learning canvas" })
    .locator("xpath=ancestor::main");
  const canvasSection = sessionCanvas.locator("section").first();
  await expect(canvasSection).toBeVisible({ timeout: 45_000 });
  await expect(display.locator("main section").first()).toBeVisible();
  await expect(canvasSection.getByRole("heading")).not.toHaveText(
    "Start at the board.",
  );
});
