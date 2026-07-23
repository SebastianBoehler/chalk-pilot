import { expect, test } from "@playwright/test";

test("presentation surface contains no setup controls", async ({ page }) => {
  await page.goto("/display");

  await expect(page.getByText("Waiting for controller")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Start at the board." }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
});
