import type {
  CategoryStatItem,
  ExpenseCategory,
  ExpenseStatisticsSummary,
  Repayment,
  SettlementTransfer,
  Transaction,
} from "@/types/transaction";

/**
 * 檢查數值是否為合法的安全整數
 * 嚴格禁止浮點數進入金額計算核心
 */
export function assertSafeIntegerAmount(amount: number, fieldName = "金額"): void {
  if (!Number.isSafeInteger(amount)) {
    throw new Error(`${fieldName}必須為整數最小單位，禁止使用浮點數`);
  }
}

/**
 * 驗證支出基本欄位（User Story 4）
 * - 項目名稱不可空白
 * - 金額必須為大於 0 的整數
 * - 必須至少選擇一位分攤成員
 */
export function validateExpenseInput(params: {
  title: string;
  amount: number | null | undefined;
  participants: string[];
}): { valid: boolean; error?: string } {
  const trimmedTitle = params.title.trim();
  if (!trimmedTitle) {
    return { valid: false, error: "請輸入項目名稱" };
  }
  if (
    params.amount === null ||
    params.amount === undefined ||
    !Number.isSafeInteger(params.amount) ||
    params.amount <= 0
  ) {
    return { valid: false, error: "請輸入大於 0 的金額" };
  }
  if (params.amount > 1_000_000_000_000) {
    return { valid: false, error: "金額不可超過 1,000,000,000,000 元" };
  }
  if (params.participants.length === 0) {
    return { valid: false, error: "請至少選擇一位分攤成員" };
  }
  return { valid: true };
}

/**
 * 整數金額加總（嚴格檢查每個項目皆為整數）
 */
export function sumIntegerAmounts(amounts: readonly number[]): number {
  let total = 0;
  for (const val of amounts) {
    assertSafeIntegerAmount(val);
    total += val;
  }
  return total;
}

/**
 * 平均分攤演算法（User Story 5 Scenario 1）
 * 以整數商與餘數計算，除不盡的零頭（1 元）依參與者順序分配給前 remainder 位成員，
 * 保證所有成員分攤金額皆為整數，且總和 100% 等於原始支出總額。
 */
export function calculateEqualSplit(
  totalAmount: number,
  participants: readonly string[],
): Record<string, number> {
  assertSafeIntegerAmount(totalAmount, "支出總額");
  if (totalAmount <= 0) {
    throw new Error("請輸入大於 0 的金額");
  }
  const uniqueParticipants = Array.from(new Set(participants));
  const count = uniqueParticipants.length;
  if (count === 0) {
    throw new Error("請至少選擇一位分攤成員");
  }

  // 使用 BigInt 進行整數除法與取餘數，徹底杜絕浮點數運算
  const totalBig = BigInt(totalAmount);
  const countBig = BigInt(count);
  const baseShare = Number(totalBig / countBig);
  const remainder = Number(totalBig % countBig);

  const result: Record<string, number> = {};
  uniqueParticipants.forEach((uid, index) => {
    result[uid] = index < remainder ? baseShare + 1 : baseShare;
  });

  return result;
}

/**
 * 指定金額分攤驗證（User Story 5 Scenario 2）
 * 檢查所有指定分攤金額是否皆為非負整數，且加總等於支出總額。
 */
export function validateCustomSplit(
  totalAmount: number,
  splits: Record<string, number>,
  participants: readonly string[],
): { valid: boolean; error?: string; normalizedSplits?: Record<string, number> } {
  assertSafeIntegerAmount(totalAmount, "支出總額");
  if (totalAmount <= 0) {
    return { valid: false, error: "請輸入大於 0 的金額" };
  }
  const uniqueParticipants = Array.from(new Set(participants));
  if (uniqueParticipants.length === 0) {
    return { valid: false, error: "請至少選擇一位分攤成員" };
  }

  const normalized: Record<string, number> = {};
  let sum = 0;

  for (const uid of uniqueParticipants) {
    const share = splits[uid] ?? 0;
    if (!Number.isSafeInteger(share) || share < 0) {
      return { valid: false, error: "指定分攤金額必須為大於或等於 0 的整數" };
    }
    normalized[uid] = share;
    sum += share;
  }

  if (sum !== totalAmount) {
    return {
      valid: false,
      error: `分攤金額加總（${sum} 元）與支出總額（${totalAmount} 元）不符`,
    };
  }

  return { valid: true, normalizedSplits: normalized };
}

/**
 * 計算群組內每位成員的淨額（Net Balance）（User Story 6 & 7）
 * - 正數代表「應收金額（別人欠他）」
 * - 負數代表「應付金額（他欠別人）」
 * - 0 代表「已結清」
 * 計算範圍包含所有支出交易與所有「已確認 (confirmed)」的還款紀錄。
 */
export function calculateNetBalances(
  members: readonly string[],
  transactions: readonly Pick<Transaction, "amount" | "payerId" | "splits">[],
  repayments: readonly Pick<Repayment, "fromUid" | "toUid" | "amount" | "status">[] = [],
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const uid of members) {
    balances[uid] = 0;
  }

  for (const tx of transactions) {
    assertSafeIntegerAmount(tx.amount, "交易金額");
    const splitValues = Object.values(tx.splits);
    const splitSum = sumIntegerAmounts(splitValues);
    if (splitSum !== tx.amount) {
      throw new Error(
        `交易分攤總和（${splitSum} 元）與交易總額（${tx.amount} 元）不一致`,
      );
    }

    if (balances[tx.payerId] === undefined) {
      balances[tx.payerId] = 0;
    }
    balances[tx.payerId] += tx.amount;

    for (const [uid, share] of Object.entries(tx.splits)) {
      if (balances[uid] === undefined) {
        balances[uid] = 0;
      }
      balances[uid] -= share;
    }
  }

  // 納入已確認的還款：還款人 (fromUid) 支付給收款人 (toUid)，因此還款人淨額增加、收款人淨額減少
  for (const rep of repayments) {
    if (rep.status !== "confirmed") {
      continue;
    }
    assertSafeIntegerAmount(rep.amount, "還款金額");
    if (balances[rep.fromUid] === undefined) {
      balances[rep.fromUid] = 0;
    }
    if (balances[rep.toUid] === undefined) {
      balances[rep.toUid] = 0;
    }
    balances[rep.fromUid] += rep.amount;
    balances[rep.toUid] -= rep.amount;
  }

  return balances;
}

/**
 * 最少轉帳次數結算演算法（User Story 6）
 * 根據每位成員的淨額，將欠款人（淨額 < 0）與債權人（淨額 > 0）依絕對金額由大到小排序並配對，
 * 產生建議還款清單，且所有轉帳皆為正整數。
 */
export function simplifyDebts(
  netBalances: Record<string, number>,
): SettlementTransfer[] {
  const debtors: { uid: string; amount: number }[] = [];
  const creditors: { uid: string; amount: number }[] = [];

  let totalNet = 0;
  for (const [uid, balance] of Object.entries(netBalances)) {
    assertSafeIntegerAmount(balance, "成員淨額");
    totalNet += balance;
    if (balance < 0) {
      debtors.push({ uid, amount: -balance });
    } else if (balance > 0) {
      creditors.push({ uid, amount: balance });
    }
  }

  if (totalNet !== 0) {
    throw new Error("全體成員淨額總和必須為 0");
  }

  // 排序：金額大者優先配對，金額相同時依 UID 字典序保持決定性結果
  const sortDesc = (
    a: { uid: string; amount: number },
    b: { uid: string; amount: number },
  ) => (b.amount !== a.amount ? b.amount - a.amount : a.uid.localeCompare(b.uid));

  const transfers: SettlementTransfer[] = [];

  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(sortDesc);
    creditors.sort(sortDesc);

    const debtor = debtors[0];
    const creditor = creditors[0];
    const settleAmount =
      debtor.amount < creditor.amount ? debtor.amount : creditor.amount;

    transfers.push({
      fromUid: debtor.uid,
      toUid: creditor.uid,
      amount: settleAmount,
    });

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount === 0) {
      debtors.shift();
    }
    if (creditor.amount === 0) {
      creditors.shift();
    }
  }

  return transfers;
}

/**
 * 查詢特定欠款人對特定收款人的目前欠款金額（或欠款人總欠款上限）
 * 優先檢查建議結算清單中該配對的欠款金額；若無直接配對，則以欠款人未結清欠款與收款人待收款之較小值為上限。
 */
export function getMaxRepayableAmount(
  netBalances: Record<string, number>,
  fromUid: string,
  toUid: string,
): number {
  if (fromUid === toUid) {
    return 0;
  }
  const fromBalance = netBalances[fromUid] ?? 0;
  const toBalance = netBalances[toUid] ?? 0;
  if (fromBalance >= 0 || toBalance <= 0) {
    return 0;
  }

  const transfers = simplifyDebts(netBalances);
  const directTransfer = transfers.find(
    (t) => t.fromUid === fromUid && t.toUid === toUid,
  );
  if (directTransfer) {
    return directTransfer.amount;
  }

  const debtorOwed = -fromBalance;
  const creditorReceivable = toBalance;
  return debtorOwed < creditorReceivable ? debtorOwed : creditorReceivable;
}

/**
 * 驗證標記還款金額（User Story 7 Scenario 1 & 2）
 */
export function validateRepaymentAmount(params: {
  netBalances: Record<string, number>;
  fromUid: string;
  toUid: string;
  amount: number;
}): { valid: boolean; error?: string } {
  const { netBalances, fromUid, toUid, amount } = params;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { valid: false, error: "請輸入大於 0 的整數還款金額" };
  }
  if (amount > 1_000_000_000_000) {
    return { valid: false, error: "還款金額不可超過 1,000,000,000,000 元" };
  }

  const maxAllowed = getMaxRepayableAmount(netBalances, fromUid, toUid);
  if (maxAllowed <= 0) {
    return { valid: false, error: "目前對該成員沒有待還款項" };
  }

  if (amount > maxAllowed) {
    return {
      valid: false,
      error: `還款金額超過目前欠款（${maxAllowed} 元），請確認金額`,
    };
  }

  return { valid: true };
}

/**
 * 檢查成員是否可被移除（User Story 9 Scenario 1 & 2）
 * 若該成員淨額不為 0，或有未確認 (pending) 的還款紀錄，則不可移除。
 */
export function canRemoveMember(params: {
  targetUid: string;
  netBalances: Record<string, number>;
  pendingRepayments?: readonly Pick<Repayment, "fromUid" | "toUid" | "status">[];
}): { allowed: boolean; error?: string } {
  const balance = params.netBalances[params.targetUid] ?? 0;
  const hasPending = (params.pendingRepayments ?? []).some(
    (r) =>
      r.status === "pending" &&
      (r.fromUid === params.targetUid || r.toUid === params.targetUid),
  );

  if (balance !== 0 || hasPending) {
    return {
      allowed: false,
      error: "此成員尚有未結清款項，請先完成結算",
    };
  }

  return { allowed: true };
}

const ALL_CATEGORIES: readonly ExpenseCategory[] = [
  "餐飲",
  "交通",
  "住宿",
  "娛樂",
  "購物",
  "其他",
];

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateStatisticsDateRange(
  startDate?: string,
  endDate?: string,
): { valid: boolean; error?: string } {
  if (startDate && !isValidISODate(startDate)) {
    return { valid: false, error: "請選擇有效的統計開始日期" };
  }
  if (endDate && !isValidISODate(endDate)) {
    return { valid: false, error: "請選擇有效的統計結束日期" };
  }
  if (startDate && endDate && startDate > endDate) {
    return { valid: false, error: "統計開始日期不可晚於結束日期" };
  }
  return { valid: true };
}

/**
 * 依時間範圍與類別計算支出統計（User Story 10）
 * 所有百分比以 BigInt 整數運算（最大餘數法分配百分比餘數，確保有支出時各類別百分比整數總和為 100）。
 */
export function calculateExpenseStatistics(params: {
  transactions: readonly Pick<
    Transaction,
    "amount" | "category" | "date" | "splits"
  >[];
  userUid: string;
  startDate?: string;
  endDate?: string;
}): ExpenseStatisticsSummary {
  const { transactions, userUid, startDate, endDate } = params;
  const dateRange = validateStatisticsDateRange(startDate, endDate);
  if (!dateRange.valid) {
    throw new Error(dateRange.error);
  }

  const filtered = transactions.filter((tx) => {
    if (startDate && tx.date < startDate) {
      return false;
    }
    if (endDate && tx.date > endDate) {
      return false;
    }
    return true;
  });

  let totalGroupExpense = 0;
  let personalShareTotal = 0;
  const categoryTotals: Record<ExpenseCategory, number> = {
    餐飲: 0,
    交通: 0,
    住宿: 0,
    娛樂: 0,
    購物: 0,
    其他: 0,
  };

  for (const tx of filtered) {
    assertSafeIntegerAmount(tx.amount, "統計交易金額");
    totalGroupExpense += tx.amount;
    categoryTotals[tx.category] += tx.amount;

    const myShare = tx.splits[userUid] ?? 0;
    assertSafeIntegerAmount(myShare, "個人分攤金額");
    personalShareTotal += myShare;
  }

  if (totalGroupExpense === 0) {
    return {
      totalGroupExpense: 0,
      personalShareTotal: 0,
      categoryBreakdown: ALL_CATEGORIES.map((category) => ({
        category,
        amount: 0,
        percentage: 0,
      })),
    };
  }

  // 使用 BigInt 計算整數百分比與餘數，保證不涉及浮點數且總和為 100%
  const totalBig = BigInt(totalGroupExpense);
  const rawItems = ALL_CATEGORIES.map((category, index) => {
    const amount = categoryTotals[category];
    const scaled = BigInt(amount) * BigInt(100);
    const basePct = Number(scaled / totalBig);
    const rem = Number(scaled % totalBig);
    return { category, amount, basePct, rem, index };
  });

  const sumBasePct = rawItems.reduce((acc, item) => acc + item.basePct, 0);
  const pctDiff = 100 - sumBasePct;

  const sortedByRem = [...rawItems].sort((a, b) =>
    b.rem !== a.rem ? b.rem - a.rem : a.index - b.index,
  );
  const bonusCategories = new Set(
    sortedByRem.slice(0, pctDiff).map((item) => item.category),
  );

  const categoryBreakdown: CategoryStatItem[] = rawItems.map((item) => ({
    category: item.category,
    amount: item.amount,
    percentage: bonusCategories.has(item.category)
      ? item.basePct + 1
      : item.basePct,
  }));

  return {
    totalGroupExpense,
    personalShareTotal,
    categoryBreakdown,
  };
}

/**
 * 顯示層金額格式化（僅於 React 顯示層呼叫，內部仍驗證整數）
 */
export function formatCurrencyInteger(
  amount: number,
  currency = "TWD",
): string {
  assertSafeIntegerAmount(amount, "顯示金額");
  const formattedNumber = amount.toLocaleString("zh-TW");
  switch (currency) {
    case "TWD":
      return `NT$ ${formattedNumber}`;
    case "JPY":
      return `¥ ${formattedNumber}`;
    case "USD":
      return `US$ ${formattedNumber}`;
    case "EUR":
      return `€ ${formattedNumber}`;
    case "KRW":
      return `₩ ${formattedNumber}`;
    default:
      return `${currency} ${formattedNumber}`;
  }
}
