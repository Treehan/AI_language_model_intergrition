import { expect, test } from "@playwright/test";

test("首頁可載入並顯示應用程式名稱", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("小組記帳與分帳 App");
  await expect(
    page.getByRole("heading", { name: "小組記帳與分帳 App" }),
  ).toBeVisible();
});
