import { describe, expect, it } from "vitest";
import {
  assertSafeIntegerAmount,
  calculateEqualSplit,
  calculateExpenseStatistics,
  calculateNetBalances,
  canRemoveMember,
  formatCurrencyInteger,
  getMaxRepayableAmount,
  simplifyDebts,
  sumIntegerAmounts,
  validateCustomSplit,
  validateExpenseInput,
  validateRepaymentAmount,
} from "../../src/lib/finance/index";

describe("財務計算核心 (lib/finance) - 100% 覆蓋率與領域鐵律驗證", () => {
  describe("assertSafeIntegerAmount & sumIntegerAmounts", () => {
    it("接受合法整數並拒絕浮點數或 NaN", () => {
      expect(() => assertSafeIntegerAmount(1000)).not.toThrow();
      expect(() => assertSafeIntegerAmount(0)).not.toThrow();
      expect(() => assertSafeIntegerAmount(10.5, "測試金額")).toThrow(
        "測試金額必須為整數最小單位，禁止使用浮點數",
      );
      expect(() => assertSafeIntegerAmount(Number.NaN)).toThrow(
        "金額必須為整數最小單位，禁止使用浮點數",
      );
    });

    it("正確加總整數陣列", () => {
      expect(sumIntegerAmounts([334, 333, 333])).toBe(1000);
      expect(sumIntegerAmounts([])).toBe(0);
    });
  });

  describe("validateExpenseInput (User Story 4)", () => {
    it("驗證項目名稱、金額大於 0 與分攤成員", () => {
      expect(
        validateExpenseInput({
          title: "   ",
          amount: 100,
          participants: ["u1"],
        }),
      ).toEqual({ valid: false, error: "請輸入項目名稱" });

      expect(
        validateExpenseInput({
          title: "晚餐",
          amount: 0,
          participants: ["u1"],
        }),
      ).toEqual({ valid: false, error: "請輸入大於 0 的金額" });

      expect(
        validateExpenseInput({
          title: "晚餐",
          amount: -50,
          participants: ["u1"],
        }),
      ).toEqual({ valid: false, error: "請輸入大於 0 的金額" });

      expect(
        validateExpenseInput({
          title: "晚餐",
          amount: null,
          participants: ["u1"],
        }),
      ).toEqual({ valid: false, error: "請輸入大於 0 的金額" });

      expect(
        validateExpenseInput({
          title: "晚餐",
          amount: 500,
          participants: [],
        }),
      ).toEqual({ valid: false, error: "請至少選擇一位分攤成員" });

      expect(
        validateExpenseInput({
          title: "晚餐",
          amount: 500,
          participants: ["u1", "u2"],
        }),
      ).toEqual({ valid: true });
    });
  });

  describe("calculateEqualSplit (User Story 5 Scenario 1)", () => {
    it("1000 元由 3 人平均分攤時，自動分配餘數且總和等於 1000 元", () => {
      const splits = calculateEqualSplit(1000, ["u1", "u2", "u3"]);
      expect(splits).toEqual({
        u1: 334,
        u2: 333,
        u3: 333,
      });
      expect(sumIntegerAmounts(Object.values(splits))).toBe(1000);
    });

    it("整除時每人金額相同", () => {
      const splits = calculateEqualSplit(900, ["u1", "u2", "u3"]);
      expect(splits).toEqual({ u1: 300, u2: 300, u3: 300 });
    });

    it("拒絕小於等於 0 的金額或空成員清單", () => {
      expect(() => calculateEqualSplit(0, ["u1"])).toThrow(
        "請輸入大於 0 的金額",
      );
      expect(() => calculateEqualSplit(100, [])).toThrow(
        "請至少選擇一位分攤成員",
      );
    });
  });

  describe("validateCustomSplit (User Story 5 Scenario 2)", () => {
    it("當指定金額加總與支出總額不符時顯示明確錯誤訊息", () => {
      const res = validateCustomSplit(
        1000,
        { u1: 400, u2: 300, u3: 200 },
        ["u1", "u2", "u3"],
      );
      expect(res).toEqual({
        valid: false,
        error: "分攤金額加總（900 元）與支出總額（1000 元）不符",
      });
    });

    it("驗證通過時回傳正規化後的分攤表", () => {
      const res = validateCustomSplit(
        1000,
        { u1: 500, u2: 500 },
        ["u1", "u2", "u3"],
      );
      expect(res).toEqual({
        valid: true,
        normalizedSplits: { u1: 500, u2: 500, u3: 0 },
      });
    });

    it("拒絕非正數總額、空參與者或負數分攤金額", () => {
      expect(validateCustomSplit(0, { u1: 0 }, ["u1"])).toEqual({
        valid: false,
        error: "請輸入大於 0 的金額",
      });
      expect(validateCustomSplit(100, { u1: 100 }, [])).toEqual({
        valid: false,
        error: "請至少選擇一位分攤成員",
      });
      expect(
        validateCustomSplit(100, { u1: -10, u2: 110 }, ["u1", "u2"]),
      ).toEqual({
        valid: false,
        error: "指定分攤金額必須為大於或等於 0 的整數",
      });
    });
  });

  describe("calculateNetBalances & simplifyDebts (User Story 6 & 7)", () => {
    it("正確計算成員淨額並產出最少轉帳次數的還款建議", () => {
      const members = ["u1", "u2", "u3"];
      const transactions = [
        {
          amount: 1000,
          payerId: "u1",
          splits: { u1: 334, u2: 333, u3: 333 },
        },
        {
          amount: 300,
          payerId: "u2",
          splits: { u1: 100, u2: 100, u3: 100 },
        },
      ];

      const balances = calculateNetBalances(members, transactions, [
        { fromUid: "u3", toUid: "u1", amount: 100, status: "confirmed" },
        { fromUid: "u3", toUid: "u1", amount: 50, status: "pending" },
      ]);

      // u1: +1000 - 334 - 100 - 100 (confirmed repayment received) = +466
      // u2: -333 + 300 - 100 = -133
      // u3: -333 - 100 + 100 (confirmed repayment paid) = -333
      expect(balances).toEqual({
        u1: 466,
        u2: -133,
        u3: -333,
      });

      const transfers = simplifyDebts(balances);
      expect(transfers).toEqual([
        { fromUid: "u3", toUid: "u1", amount: 333 },
        { fromUid: "u2", toUid: "u1", amount: 133 },
      ]);
    });

    it("處理未預先列在 members 的參與者與多位債權人情境", () => {
      const balances = calculateNetBalances(
        ["u1"],
        [
          {
            amount: 600,
            payerId: "u2",
            splits: { u1: 300, u3: 300 },
          },
        ],
        [{ fromUid: "u4", toUid: "u5", amount: 100, status: "confirmed" }],
      );
      expect(balances).toEqual({
        u1: -300,
        u2: 600,
        u3: -300,
        u4: 100,
        u5: -100,
      });

      const transfers = simplifyDebts(balances);
      expect(transfers.length).toBe(3);

      // 測試單一欠款人需要分兩筆轉給兩位債權人，且包含淨額為 0 的成員
      const multiCreditorTransfers = simplifyDebts({
        d1: -500,
        c1: 300,
        c2: 200,
        settledUser: 0,
      });
      expect(multiCreditorTransfers).toEqual([
        { fromUid: "d1", toUid: "c1", amount: 300 },
        { fromUid: "d1", toUid: "c2", amount: 200 },
      ]);
    });

    it("當交易分攤總和與交易總額不一致或淨額總和不為 0 時拋出錯誤", () => {
      expect(() =>
        calculateNetBalances(
          ["u1", "u2"],
          [{ amount: 500, payerId: "u1", splits: { u1: 200, u2: 200 } }],
        ),
      ).toThrow("交易分攤總和（400 元）與交易總額（500 元）不一致");

      expect(() => simplifyDebts({ u1: 100, u2: -50 })).toThrow(
        "全體成員淨額總和必須為 0",
      );
    });
  });

  describe("getMaxRepayableAmount & validateRepaymentAmount (User Story 7)", () => {
    const netBalances = { u1: 300, u2: 200, u3: -300, u4: -200 };

    it("當還款金額超過目前欠款時回傳正確錯誤提示", () => {
      expect(getMaxRepayableAmount(netBalances, "u3", "u1")).toBe(300);
      expect(
        validateRepaymentAmount({
          netBalances,
          fromUid: "u3",
          toUid: "u1",
          amount: 500,
        }),
      ).toEqual({
        valid: false,
        error: "還款金額超過目前欠款（300 元），請確認金額",
      });

      expect(
        validateRepaymentAmount({
          netBalances,
          fromUid: "u3",
          toUid: "u1",
          amount: 300,
        }),
      ).toEqual({ valid: true });
    });

    it("處理非直接配對債權人、無欠款或無效金額情境", () => {
      // u3 (-300) 對 u2 (+200) 非第一順位直接配對，但上限為 min(300, 200) = 200
      expect(getMaxRepayableAmount(netBalances, "u3", "u2")).toBe(200);
      // u4 (-200) 對 u1 (+300) 非第一順位直接配對，上限為 min(200, 300) = 200 (測試 debtorOwed < creditorReceivable 分支)
      expect(getMaxRepayableAmount(netBalances, "u4", "u1")).toBe(200);
      // 不在 netBalances 中的使用者
      expect(getMaxRepayableAmount(netBalances, "unknown1", "unknown2")).toBe(0);
      // 同一人或無欠款方向
      expect(getMaxRepayableAmount(netBalances, "u1", "u1")).toBe(0);
      expect(getMaxRepayableAmount(netBalances, "u1", "u3")).toBe(0);

      expect(
        validateRepaymentAmount({
          netBalances,
          fromUid: "u3",
          toUid: "u1",
          amount: 0,
        }),
      ).toEqual({
        valid: false,
        error: "請輸入大於 0 的整數還款金額",
      });

      expect(
        validateRepaymentAmount({
          netBalances,
          fromUid: "u1",
          toUid: "u2",
          amount: 100,
        }),
      ).toEqual({
        valid: false,
        error: "目前對該成員沒有待還款項",
      });
    });
  });

  describe("canRemoveMember (User Story 9)", () => {
    it("成員無未結清款項時允許移除，否則拒絕並回傳指定訊息", () => {
      expect(
        canRemoveMember({
          targetUid: "u1",
          netBalances: { u1: 0, u2: 0 },
        }),
      ).toEqual({ allowed: true });

      expect(
        canRemoveMember({
          targetUid: "u1",
          netBalances: { u1: -200, u2: 200 },
        }),
      ).toEqual({
        allowed: false,
        error: "此成員尚有未結清款項，請先完成結算",
      });

      expect(
        canRemoveMember({
          targetUid: "u1",
          netBalances: { u1: 0, u2: 0 },
          pendingRepayments: [
            { fromUid: "u1", toUid: "u2", status: "pending" },
          ],
        }),
      ).toEqual({
        allowed: false,
        error: "此成員尚有未結清款項，請先完成結算",
      });

      expect(
        canRemoveMember({
          targetUid: "u2",
          netBalances: { u2: 0 },
          pendingRepayments: [
            { fromUid: "u1", toUid: "u2", status: "pending" },
          ],
        }),
      ).toEqual({
        allowed: false,
        error: "此成員尚有未結清款項，請先完成結算",
      });

      expect(
        canRemoveMember({
          targetUid: "u99",
          netBalances: {},
          pendingRepayments: [
            { fromUid: "u1", toUid: "u2", status: "confirmed" },
          ],
        }),
      ).toEqual({ allowed: true });
    });
  });

  describe("calculateExpenseStatistics & formatCurrencyInteger (User Story 10)", () => {
    it("依時間範圍篩選並計算各類別百分比、群組總支出與個人分攤金額", () => {
      const transactions = [
        {
          amount: 100,
          category: "餐飲" as const,
          date: "2026-11-01",
          splits: { u1: 50, u2: 50 },
        },
        {
          amount: 100,
          category: "交通" as const,
          date: "2026-11-10",
          splits: { u1: 40, u2: 60 },
        },
        {
          amount: 100,
          category: "住宿" as const,
          date: "2026-11-15",
          splits: { u1: 60, u2: 40 },
        },
        {
          amount: 500,
          category: "購物" as const,
          date: "2026-12-01",
          splits: { u1: 250, u2: 250 },
        },
      ];

      const stats = calculateExpenseStatistics({
        transactions,
        userUid: "u1",
        startDate: "2026-11-05",
        endDate: "2026-11-20",
      });

      expect(stats.totalGroupExpense).toBe(200);
      expect(stats.personalShareTotal).toBe(100);
      const pctSum = stats.categoryBreakdown.reduce(
        (acc, c) => acc + c.percentage,
        0,
      );
      expect(pctSum).toBe(100);

      // 測試 3 個等額類別時餘數百分比分配 (34%, 33%, 33%)
      const statsAllNov = calculateExpenseStatistics({
        transactions,
        userUid: "u3",
        endDate: "2026-11-30",
      });
      expect(statsAllNov.totalGroupExpense).toBe(300);
      expect(statsAllNov.personalShareTotal).toBe(0);
      expect(
        statsAllNov.categoryBreakdown.reduce((acc, c) => acc + c.percentage, 0),
      ).toBe(100);
    });

    it("無支出紀錄時回傳 0", () => {
      const emptyStats = calculateExpenseStatistics({
        transactions: [],
        userUid: "u1",
      });
      expect(emptyStats.totalGroupExpense).toBe(0);
      expect(emptyStats.personalShareTotal).toBe(0);
      expect(
        emptyStats.categoryBreakdown.every((c) => c.percentage === 0),
      ).toBe(true);
    });

    it("正確格式化各種幣別的整數金額", () => {
      expect(formatCurrencyInteger(1000)).toBe("NT$ 1,000");
      expect(formatCurrencyInteger(5000, "JPY")).toBe("¥ 5,000");
      expect(formatCurrencyInteger(200, "USD")).toBe("US$ 200");
      expect(formatCurrencyInteger(300, "EUR")).toBe("€ 300");
      expect(formatCurrencyInteger(10000, "KRW")).toBe("₩ 10,000");
      expect(formatCurrencyInteger(88, "GBP")).toBe("GBP 88");
    });
  });
});
