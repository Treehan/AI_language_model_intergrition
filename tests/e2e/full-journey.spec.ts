import { expect, test } from "@playwright/test";

test.describe("小組記帳與分帳 App - 端對端全功能流程驗證 (End-to-End Comprehensive Journey)", () => {
  test("完整旅程：從註冊登入、建立群組、邀請成員、新增平均與指定支出、管理者修改、結算還款到統計分析與帳號管理", async ({
    page,
  }) => {
    // -------------------------------------------------------------------------
    // 步驟 1: 進入首頁，驗證應用程式標題與預設帳本載入
    // -------------------------------------------------------------------------
    await page.goto("/");
    await expect(page).toHaveTitle("小組記帳與分帳 App");
    await expect(
      page.getByRole("heading", { name: "小組記帳與分帳 App" }),
    ).toBeVisible();
    await expect(page.getByTestId("active-ledger-title")).toHaveText(
      "花蓮三天兩夜旅遊帳本",
    );

    // -------------------------------------------------------------------------
    // 步驟 2 (User Story 1): 註冊新帳號、重複帳號檢查與自動登入
    // -------------------------------------------------------------------------
    await page.getByRole("button", { name: "帳號管理 / 建立帳號" }).click();

    // 2.1 檢查已存在帳號阻擋
    await page.getByLabel("電子郵件或手機號碼").fill("alice@example.com");
    await page.getByLabel("密碼").fill("password123");
    await page.getByLabel("暱稱").fill("小美重複");
    await page.getByRole("button", { name: "建立帳號", exact: true }).click();
    await expect(
      page.getByText("此帳號已存在，請直接登入").first(),
    ).toBeVisible();

    // 2.2 成功註冊新會員「李小華」
    await page.getByLabel("電子郵件或手機號碼").fill("hua@example.com");
    await page.getByLabel("密碼").fill("securePass888");
    await page.getByLabel("暱稱").fill("李小華");
    await page.getByRole("button", { name: "建立帳號", exact: true }).click();

    await expect(page.getByTestId("current-user-name")).toHaveText("李小華");

    // -------------------------------------------------------------------------
    // 步驟 3 (User Story 2 & 3): 建立新記帳群組、邀請連結、QR Code 與加入驗證
    // -------------------------------------------------------------------------
    await page.getByRole("button", { name: "群組與成員", exact: true }).click();

    // 3.1 測試失效邀請碼阻擋
    await page.getByLabel("邀請連結或邀請碼").fill("EXPIRED2025");
    await page.getByRole("button", { name: "加入群組" }).click();
    await expect(
      page.getByText("此邀請連結已失效，請向群組管理者索取新連結"),
    ).toBeVisible();

    // 3.2 建立新群組「京都賞櫻漫遊」
    await page.getByLabel("群組名稱").fill("京都賞櫻漫遊");
    await page.getByLabel("帳本幣別").selectOption("JPY");
    await page.getByRole("button", { name: "建立群組" }).click();

    await expect(page.getByTestId("active-ledger-title")).toHaveText(
      "京都賞櫻漫遊",
    );
    await expect(page.getByTestId("ledger-invite-link")).toContainText(
      "invite=INV-",
    );
    const qrCode = page.getByLabel("群組邀請 QR Code").locator("svg");
    await expect(qrCode).toBeVisible();

    // 3.3 切換為測試會員林大明加入「京都賞櫻漫遊」
    const kyotoInviteCode = await page
      .getByTestId("ledger-invite-code")
      .innerText();
    await page.getByLabel("快速切換測試會員").selectOption("user-member-2");
    await page.getByLabel("邀請連結或邀請碼").fill(kyotoInviteCode);
    await page.getByRole("button", { name: "加入群組" }).click();
    await expect(page.getByTestId("active-ledger-title")).toHaveText(
      "京都賞櫻漫遊",
    );
    await expect(
      page.getByTestId("member-row-user-member-2").getByText("一般成員"),
    ).toBeVisible();

    // -------------------------------------------------------------------------
    // 步驟 4: 切換回「花蓮三天兩夜旅遊帳本」進行支出、分帳與結算全流程測試
    // -------------------------------------------------------------------------
    await page.getByRole("button", { name: "花蓮三天兩夜旅遊帳本" }).click();
    await expect(page.getByTestId("active-ledger-title")).toHaveText(
      "花蓮三天兩夜旅遊帳本",
    );

    // -------------------------------------------------------------------------
    // 步驟 5 (User Story 4 & 5): 新增支出防呆、平均分攤與自訂指定分帳
    // -------------------------------------------------------------------------
    await page.getByRole("button", { name: "支出帳目", exact: true }).click();

    // 5.1 金額 <= 0 防呆驗證
    await page.getByLabel("項目名稱").fill("測試無效金額");
    await page.getByLabel(/金額/).fill("0");
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(page.getByText("請輸入大於 0 的金額")).toBeVisible();

    // 5.2 指定金額加總不符防呆驗證
    await page.getByLabel("項目名稱").fill("慶功熱炒晚餐");
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

    // 5.3 切換為平均分攤並成功儲存（1000 元由陳小美、林大明、張雅婷 3 人分攤，不勾選王志豪）
    // 預先取消王志豪勾選，確保王志豪淨額保持為 0 元
    await page.getByRole("checkbox", { name: "王志豪" }).uncheck();
    await page.getByRole("button", { name: "平均分攤" }).click();
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(
      page.getByText("慶功熱炒晚餐", { exact: true }),
    ).toBeVisible();

    // -------------------------------------------------------------------------
    // 步驟 6 (User Story 8): 群組管理者修改支出與歷史紀錄追蹤
    // -------------------------------------------------------------------------
    await page.getByLabel("快速切換測試會員").selectOption("user-owner-1");
    await page.getByRole("button", { name: "修改東大門夜市聚餐" }).click();
    await page.getByLabel(/金額/).fill("1200");
    await page.getByRole("button", { name: "儲存" }).click();
    await expect(page.getByText(/修改紀錄：原為「東大門夜市聚餐」/)).toBeVisible();

    // -------------------------------------------------------------------------
    // 步驟 7 (User Story 6 & 7): 結算、債務簡化、超額還款阻擋與收款確認
    // -------------------------------------------------------------------------
    await page.getByLabel("快速切換測試會員").selectOption("user-member-3");
    await page.getByRole("button", { name: "結算還款", exact: true }).click();
    await expect(page.getByText("建議還款方式（最少轉帳次數）")).toBeVisible();

    // 7.1 超額還款防呆檢核
    await page.getByLabel("收款對象").selectOption("user-member-2");
    await page.getByLabel("還款金額").fill("5000");
    await page.getByRole("button", { name: "確認還款" }).click();
    await expect(
      page.getByText(/還款金額超過目前欠款（\d+ 元），請確認金額/),
    ).toBeVisible();

    // 7.2 正常標記還款 100 元
    await page.getByLabel("還款金額").fill("100");
    await page.getByRole("button", { name: "確認還款" }).click();
    await expect(
      page.getByText("已標記還款並通知收款人確認！").first(),
    ).toBeVisible();

    // 7.3 收款人（林大明）確認收款
    await page.getByLabel("快速切換測試會員").selectOption("user-member-2");
    await page.getByRole("button", { name: "收款人確認收款" }).first().click();
    await expect(
      page.getByText("收款人已確認", { exact: true }).first(),
    ).toBeVisible();

    // -------------------------------------------------------------------------
    // 步驟 8 (User Story 10): 支出統計、日期篩選與圓餅圖視覺化
    // -------------------------------------------------------------------------
    await page.getByRole("button", { name: "支出統計", exact: true }).click();

    // 8.1 測試日期顛倒防呆
    await page.getByLabel("開始日期").fill("2026-12-01");
    await page.getByLabel("結束日期").fill("2026-11-30");
    await expect(
      page.getByText("統計開始日期不可晚於結束日期"),
    ).toBeVisible();

    // 8.2 正確時間範圍顯示圖表與總金額
    await page.getByLabel("開始日期").fill("2026-11-01");
    await expect(page.getByTestId("expense-pie-chart")).toBeVisible();
    await expect(page.getByTestId("stats-total-group-expense")).toBeVisible();

    // -------------------------------------------------------------------------
    // 步驟 9 (User Story 9 & 帳號安全): 成員管理（未結清防刪）與帳號刪除
    // -------------------------------------------------------------------------
    await page.getByLabel("快速切換測試會員").selectOption("user-owner-1");
    await page.getByRole("button", { name: "群組與成員", exact: true }).click();

    // 9.1 尚有欠款成員不可移除
    await page.getByRole("button", { name: "移除張雅婷" }).click();
    await expect(
      page.getByText("此成員尚有未結清款項，請先完成結算"),
    ).toBeVisible();

    // 9.2 已結清成員可順利移除
    await page.getByRole("button", { name: "移除王志豪" }).click();
    await expect(
      page.getByText("已將該成員移出群組並發送通知").first(),
    ).toBeVisible();

    // 9.3 帳號安全防護：未結清款項成員（陳小美）禁止刪除帳號
    await page.getByRole("button", { name: "帳號管理 / 建立帳號" }).click();
    await page.getByRole("button", { name: "刪除帳號", exact: true }).click();
    await page.getByRole("button", { name: "確認刪除帳號", exact: true }).click();
    await expect(
      page.getByText("您在「花蓮三天兩夜旅遊帳本」尚有未結清款項，請先完成結算後再刪除帳號").first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "關閉", exact: true }).click();

    // 9.4 成功刪除無欠款帳號「李小華」
    await page
      .getByLabel("快速切換測試會員")
      .selectOption({ label: "測試：李小華 (hua@example.com)" });
    await page.getByRole("button", { name: "帳號管理 / 建立帳號" }).click();
    await page.getByRole("button", { name: "刪除帳號", exact: true }).click();
    await page.getByRole("button", { name: "確認刪除帳號", exact: true }).click();
    await expect(
      page.getByText(/已成功刪除帳號「李小華」並退出相關群組/).first(),
    ).toBeVisible();
  });
});
