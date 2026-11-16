import { expect, test } from "@playwright/test";

test.describe("小組記帳與分帳 App - 端對端使用者故事驗收 (User Stories 1–10)", () => {
  test("首頁可載入並顯示應用程式名稱與目前帳本", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("小組記帳與分帳 App");
    await expect(
      page.getByRole("heading", { name: "小組記帳與分帳 App" }),
    ).toBeVisible();
    await expect(page.getByTestId("active-ledger-title")).toHaveText(
      "花蓮三天兩夜旅遊帳本",
    );
  });

  test("User Story 1：建立個人帳號與重複帳號驗證", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "帳號管理 / 建立帳號" }).click();

    // Scenario 2: 帳號已存在
    await page.getByLabel("電子郵件或手機號碼").fill("alice@example.com");
    await page.getByLabel("密碼").fill("password123");
    await page.getByLabel("暱稱").fill("重複測試");
    await page.getByRole("button", { name: "建立帳號", exact: true }).click();
    await expect(
      page.getByText("此帳號已存在，請直接登入").first(),
    ).toBeVisible();

    // Scenario 1: 成功建立帳號並直接進入已登入狀態
    await page.getByLabel("電子郵件或手機號碼").fill("newmember@example.com");
    await page.getByLabel("密碼").fill("password123");
    await page.getByLabel("暱稱").fill("黃小華");
    await page.getByRole("button", { name: "建立帳號", exact: true }).click();

    await expect(page.getByTestId("current-user-name")).toHaveText("黃小華");

    // 測試刪除個人帳號：新建立的「黃小華」目前尚無未結清款項，可直接刪除帳號
    await page.getByRole("button", { name: "帳號管理 / 建立帳號" }).click();
    await page.getByRole("button", { name: "刪除帳號" }).click();
    await page.getByRole("button", { name: "確認刪除帳號" }).click();
    await expect(
      page.getByText("已成功刪除帳號「黃小華」並退出相關群組").first(),
    ).toBeVisible();
    await expect(page.getByTestId("current-user-name")).toHaveText("陳小美");

    // 測試尚有未結清款項的帳號無法刪除（陳小美目前有應收款項 +400 元）
    await page.getByRole("button", { name: "帳號管理 / 建立帳號" }).click();
    await page.getByRole("button", { name: "刪除帳號" }).click();
    await page.getByRole("button", { name: "確認刪除帳號" }).click();
    await expect(
      page
        .getByText(
          "您在「花蓮三天兩夜旅遊帳本」尚有未結清款項，請先完成結算後再刪除帳號",
        )
        .first(),
    ).toBeVisible();
  });

  test("User Story 2, 3, 9：建立群組與邀請連結 QR Code、失效連結檢查、移除成員檢查", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "群組與成員管理" }).click();

    // User Story 9 Scenario 2: 成員尚有未結清款項時無法移除 (張雅婷目前有欠款)
    await page.getByRole("button", { name: "移除張雅婷" }).click();
    await expect(
      page.getByText("此成員尚有未結清款項，請先完成結算"),
    ).toBeVisible();

    // User Story 9 Scenario 1: 成員沒有未結清款項時成功移除 (王志豪淨額為 0)
    await page.getByRole("button", { name: "移除王志豪" }).click();
    await expect(
      page.getByText("已將該成員移出群組並發送通知").first(),
    ).toBeVisible();

    // User Story 3 Scenario 2: 邀請連結失效
    await page.getByLabel("邀請連結或邀請碼").fill("EXPIRED2025");
    await page.getByRole("button", { name: "加入群組" }).click();
    await expect(
      page.getByText("此邀請連結已失效，請向群組管理者索取新連結"),
    ).toBeVisible();

    // User Story 2: 建立記帳群組並產生邀請連結與 QR Code
    await page.getByLabel("群組名稱").fill("東京賞櫻團");
    await page.getByLabel("帳本幣別").selectOption("JPY");
    await page.getByRole("button", { name: "建立群組" }).click();

    await expect(page.getByTestId("active-ledger-title")).toHaveText(
      "東京賞櫻團",
    );
    await expect(page.getByTestId("ledger-invite-link")).toContainText(
      "invite=INV-",
    );
    await expect(page.getByLabel("群組邀請 QR Code")).toBeVisible();
  });

  test("User Story 4, 5, 8：新增支出欄位驗證、平均分攤與指定金額檢查、管理者修改支出", async ({
    page,
  }) => {
    await page.goto("/");

    // User Story 4 Scenario 2: 金額為空白或小於等於 0
    await page.getByLabel("項目名稱").fill("測試支出");
    await page.getByLabel(/金額/).fill("0");
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(page.getByText("請輸入大於 0 的金額")).toBeVisible();

    // User Story 5 Scenario 2: 指定金額加總不符
    await page.getByLabel("項目名稱").fill("伴手禮採買");
    await page.getByLabel(/金額/).fill("1000");
    await page.getByRole("button", { name: "指定金額" }).click();
    await page.getByLabel("陳小美分攤金額").fill("400");
    await page.getByLabel("林大明分攤金額").fill("300");
    await page.getByLabel("張雅婷分攤金額").fill("200");
    await page.getByLabel("王志豪分攤金額").fill("0");
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(
      page.getByText("分攤金額加總（900 元）與支出總額（1000 元）不符"),
    ).toBeVisible();

    // User Story 5 Scenario 1: 選擇平均分攤並成功儲存
    await page.getByRole("button", { name: "平均分攤" }).click();
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(
      page.getByText("伴手禮採買", { exact: true }),
    ).toBeVisible();

    // User Story 8: 群組管理者修改支出並保留修改紀錄
    await page.getByRole("button", { name: "修改東大門夜市聚餐" }).click();
    await page.getByLabel(/金額/).fill("1200");
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(page.getByText(/修改紀錄：原為「東大門夜市聚餐」/)).toBeVisible();
  });

  test("User Story 6, 7, 10：查看結算、標記還款與超額檢查、查看支出統計圓餅圖", async ({
    page,
  }) => {
    await page.goto("/");

    // User Story 6: 查看結算頁面
    await page.getByRole("button", { name: "結算" }).click();
    await expect(page.getByText("建議還款方式（最少轉帳次數）")).toBeVisible();

    // User Story 7 Scenario 2: 還款金額超過目前欠款
    // 預設帳本中，張雅婷欠款 500 元（其中對陳小美建議還款 400 元、對林大明 100 元）
    await page.getByLabel("還款人（欠款方）").selectOption("user-member-3");
    await page.getByLabel("收款對象").selectOption("user-member-2");
    await page.getByLabel("還款金額").fill("500");
    await page.getByRole("button", { name: "確認還款" }).click();
    await expect(
      page.getByText("還款金額超過目前欠款（100 元），請確認金額"),
    ).toBeVisible();

    // User Story 7 Scenario 1: 成功標記還款並由收款人確認
    await page.getByLabel("還款金額").fill("100");
    await page.getByRole("button", { name: "確認還款" }).click();
    await expect(
      page.getByText("已標記還款並通知收款人確認！").first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "收款人確認收款" }).click();
    await expect(
      page.getByText("收款人已確認", { exact: true }),
    ).toBeVisible();

    // User Story 10: 查看支出統計頁面與圓餅圖
    await page.getByRole("button", { name: "統計" }).click();
    await expect(page.getByTestId("expense-pie-chart")).toBeVisible();
    await expect(page.getByTestId("stats-total-group-expense")).toContainText(
      "NT$ 1,500",
    );
  });
});
