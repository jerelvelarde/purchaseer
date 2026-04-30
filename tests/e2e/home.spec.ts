import { test, expect } from "@playwright/test";

test("home page renders scaffold ready message", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("purchaseer scaffold ready")).toBeVisible();
});
