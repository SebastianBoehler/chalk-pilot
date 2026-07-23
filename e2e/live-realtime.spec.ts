import { expect, test } from "@playwright/test";

test.skip(
  process.env.RUN_LIVE_OPENAI !== "1",
  "Set RUN_LIVE_OPENAI=1 and OPENAI_API_KEY for the live smoke test.",
);

test("submits a board image and lets the live agent update the display", async ({
  page,
}) => {
  await page.goto("/setup");
  await page.getByRole("button", { name: "Allow camera" }).click();
  await expect(page.getByLabel("Camera")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  const confirmFrame = page.getByRole("button", {
    name: "Use this board frame",
  });
  await expect(confirmFrame).toBeEnabled({ timeout: 45_000 });
  await confirmFrame.click();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open presentation window" }).click();
  const display = await popupPromise;
  await expect(page.getByText("Canvas connected")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

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

  await page.getByText("Connection test", { exact: true }).click();
  await page
    .getByLabel("Typed diagnostic turn")
    .fill(
      "For this connection check, call append_section now with id live-check, " +
        "kind markdown, title Live check, and content Realtime canvas tool verified. " +
        "Then answer in one sentence.",
    );
  await page.getByRole("button", { name: "Send test" }).click();

  await expect(
    display.getByRole("heading", { name: "Live check" }),
  ).toBeVisible({ timeout: 45_000 });
  await expect(
    page.getByRole("heading", { name: "Live check" }),
  ).toBeVisible();
  await expect(
    display.getByText("Realtime canvas tool verified."),
  ).toBeVisible();
});
