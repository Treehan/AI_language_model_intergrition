/**
 * 交易紀錄、分攤與還款模型定義
 * 所有金額欄位皆以「整數最小單位」儲存，嚴格禁止浮點數
 */

/** 支出類別 */
export type ExpenseCategory =
  | "餐飲"
  | "交通"
  | "住宿"
  | "娛樂"
  | "購物"
  | "其他";

/** 分帳方式 */
export type SplitMethod = "equal" | "custom";

/** 單一筆交易的修改歷史紀錄 */
export interface TransactionHistoryEntry {
  updatedAt: string;
  updatedBy: string;
  previousTitle: string;
  previousAmount: number;
}

/** 支出交易紀錄模型 */
export interface Transaction {
  id: string;
  ledgerId: string;
  title: string;
  /** 支出總金額（正整數最小單位） */
  amount: number;
  /** 付款人 UID */
  payerId: string;
  /** 建立者 UID */
  createdBy: string;
  /** 交易日期 (YYYY-MM-DD) */
  date: string;
  category: ExpenseCategory;
  splitMethod: SplitMethod;
  /** 參與分攤的成員 UID 清單 */
  participants: string[];
  /** 每位成員應分攤的整數金額 (UID -> 整數金額)，總和必須等於 amount */
  splits: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  /** 修改紀錄（管理員或編輯者修改時保留） */
  history: TransactionHistoryEntry[];
}

/** 還款狀態 */
export type RepaymentStatus = "pending" | "confirmed";

/** 還款紀錄模型 */
export interface Repayment {
  id: string;
  ledgerId: string;
  /** 還款人（欠款方）UID */
  fromUid: string;
  /** 收款人（債權方）UID */
  toUid: string;
  /** 還款金額（正整數最小單位） */
  amount: number;
  status: RepaymentStatus;
  createdAt: string;
  confirmedAt?: string;
}

/** 結算建議轉帳項目 */
export interface SettlementTransfer {
  fromUid: string;
  toUid: string;
  /** 建議轉帳整數金額 */
  amount: number;
}

/** 類別統計項目 */
export interface CategoryStatItem {
  category: ExpenseCategory;
  /** 該類別總金額（整數） */
  amount: number;
  /** 佔總支出的整數百分比 (0 - 100)，總和為 100（當有支出時） */
  percentage: number;
}

/** 統計頁面彙整結果 */
export interface ExpenseStatisticsSummary {
  totalGroupExpense: number;
  personalShareTotal: number;
  categoryBreakdown: CategoryStatItem[];
}
