"use client";

/**
 * 分帳結算、標記還款與支出統計 UI 元件 (components/features/settlements/)
 * 涵蓋 User Story 6 (查看結算)、User Story 7 (標記還款)、User Story 10 (查看支出統計與圓餅圖)
 * 遵循 ARCHITECTURE.md 第三大支柱：純 UI 元件僅透過 props 接收計算完成的財務數據與權限狀態。
 */
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrencyInteger } from "@/lib/finance";
import type { Ledger } from "@/types/ledger";
import type {
  ExpenseCategory,
  ExpenseStatisticsSummary,
  Repayment,
  SettlementTransfer,
} from "@/types/transaction";

export interface SettlementAndStatsPanelProps {
  mode: "settlement" | "statistics";
  ledger: Ledger;
  currentUserUid: string;
  netBalances: Record<string, number>;
  suggestedTransfers: SettlementTransfer[];
  repayments: Repayment[];
  statistics: ExpenseStatisticsSummary;
  startDate: string;
  endDate: string;
  feedbackError?: string | null;
  feedbackSuccess?: string | null;
  onChangeDateRange: (startDate: string, endDate: string) => void;
  onCreateRepayment: (fromUid: string, toUid: string, amount: number) => void;
  onConfirmRepayment: (repaymentId: string) => void;
}

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  餐飲: "#10b981",
  交通: "#3b82f6",
  住宿: "#8b5cf6",
  娛樂: "#f59e0b",
  購物: "#ec4899",
  其他: "#64748b",
};

export function SettlementAndStatsPanel({
  mode,
  ledger,
  currentUserUid,
  netBalances,
  suggestedTransfers,
  repayments,
  statistics,
  startDate,
  endDate,
  feedbackError,
  feedbackSuccess,
  onChangeDateRange,
  onCreateRepayment,
  onConfirmRepayment,
}: SettlementAndStatsPanelProps) {
  // 預設收款對象為建議結算中的第一位債權人
  const defaultCreditor =
    suggestedTransfers.find((transfer) => transfer.fromUid === currentUserUid)
      ?.toUid ??
    ledger.members.find(
      (member) => member !== currentUserUid && (netBalances[member] ?? 0) > 0,
    ) ??
    ledger.members.find((member) => member !== currentUserUid) ??
    "";

  const [toUid, setToUid] = React.useState(defaultCreditor);
  const [repayAmountStr, setRepayAmountStr] = React.useState("");

  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = repayAmountStr.trim() === "" ? 0 : Number(repayAmountStr);
    onCreateRepayment(
      currentUserUid,
      toUid,
      Number.isNaN(parsed) ? 0 : parsed,
    );
  };

  if (mode === "statistics") {
    // 建立圓餅圖 conic-gradient 字串（純顯示層視覺化，使用已計算好的整數百分比）
    let accumulatedPct = 0;
    const gradientSegments: string[] = [];
    for (const item of statistics.categoryBreakdown) {
      if (item.percentage > 0) {
        const start = accumulatedPct;
        const end = accumulatedPct + item.percentage;
        gradientSegments.push(
          `${CATEGORY_COLORS[item.category]} ${start}% ${end}%`,
        );
        accumulatedPct = end;
      }
    }
    const pieBackground =
      gradientSegments.length > 0
        ? `conic-gradient(${gradientSegments.join(", ")})`
        : "#e2e8f0";

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>支出統計分析</CardTitle>
            <CardDescription>
              依時間範圍與類別檢視支出比例圓餅圖、群組總支出與個人分攤金額
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {feedbackError && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
              >
                {feedbackError}
              </div>
            )}
            {feedbackSuccess && (
              <div
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
              >
                {feedbackSuccess}
              </div>
            )}
            {/* 時間範圍篩選器 (User Story 10) */}
            <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="stats-start-date"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  開始日期
                </label>
                <Input
                  id="stats-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => onChangeDateRange(e.target.value, endDate)}
                />
              </div>
              <div>
                <label
                  htmlFor="stats-end-date"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  結束日期
                </label>
                <Input
                  id="stats-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => onChangeDateRange(startDate, e.target.value)}
                />
              </div>
            </div>

            {/* 總覽指標卡 */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <p className="text-xs font-medium text-emerald-800">
                  群組總支出
                </p>
                <p
                  data-testid="stats-total-group-expense"
                  className="mt-1 text-2xl font-bold text-emerald-950"
                >
                  {formatCurrencyInteger(
                    statistics.totalGroupExpense,
                    ledger.currency,
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
                <p className="text-xs font-medium text-blue-800">
                  個人分攤金額（
                  {ledger.memberProfiles[currentUserUid]?.displayName ??
                    currentUserUid}
                  ）
                </p>
                <p
                  data-testid="stats-personal-share"
                  className="mt-1 text-2xl font-bold text-blue-950"
                >
                  {formatCurrencyInteger(
                    statistics.personalShareTotal,
                    ledger.currency,
                  )}
                </p>
              </div>
            </div>

            {/* 圓餅圖與各類別比例列表 */}
            <div className="grid items-center gap-6 md:grid-cols-2">
              <div className="flex flex-col items-center justify-center py-4">
                <div
                  role="img"
                  aria-label="各類別支出比例圓餅圖"
                  data-testid="expense-pie-chart"
                  className="relative h-48 w-48 rounded-full shadow-inner"
                  style={{ background: pieBackground }}
                >
                  <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-xs">
                    <span className="text-[11px] text-slate-500">總計</span>
                    <span className="text-sm font-bold text-slate-900">
                      {statistics.totalGroupExpense} 元
                    </span>
                  </div>
                </div>
                <span className="mt-3 text-xs font-medium text-slate-600">
                  各類別支出比例圓餅圖
                </span>
              </div>

              <div className="space-y-2.5">
                {statistics.categoryBreakdown.map((item) => (
                  <div
                    key={item.category}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{
                          backgroundColor: CATEGORY_COLORS[item.category],
                        }}
                      />
                      <span className="text-sm font-medium text-slate-900">
                        {item.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-semibold text-slate-900">
                        {formatCurrencyInteger(item.amount, ledger.currency)}
                      </span>
                      <Badge variant="secondary">{item.percentage}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {feedbackError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
        >
          {feedbackError}
        </div>
      )}
      {feedbackSuccess && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {feedbackSuccess}
        </div>
      )}

      {/* User Story 6：每位成員的淨額與最少轉帳次數建議還款方式 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>各成員目前淨額</CardTitle>
            <CardDescription>
              正數代表應收款項（別人欠他），負數代表應付款項（他欠別人）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {ledger.members.map((uid) => {
              const balance = netBalances[uid] ?? 0;
              const name = ledger.memberProfiles[uid]?.displayName ?? uid;
              return (
                <div
                  key={uid}
                  data-testid={`settlement-balance-${uid}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5"
                >
                  <span className="font-medium text-slate-900">{name}</span>
                  <span
                    className={`font-semibold ${
                      balance > 0
                        ? "text-emerald-700"
                        : balance < 0
                          ? "text-rose-700"
                          : "text-slate-600"
                    }`}
                  >
                    {balance > 0
                      ? `+${balance} 元（應收）`
                      : balance < 0
                        ? `${balance} 元（欠款 ${-balance} 元）`
                        : "0 元（已結清）"}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>建議還款方式（最少轉帳次數）</CardTitle>
            <CardDescription>
              系統已透過債務簡化演算法計算出最少轉帳次數的結算路徑
            </CardDescription>
          </CardHeader>
          <CardContent>
            {suggestedTransfers.length === 0 ? (
              <p className="py-6 text-center text-sm text-emerald-700 font-medium">
                目前群組內所有款項皆已結清，無須轉帳！
              </p>
            ) : (
              <div className="space-y-3">
                {suggestedTransfers.map((tr) => {
                  const fromName =
                    ledger.memberProfiles[tr.fromUid]?.displayName ??
                    tr.fromUid;
                  const toName =
                    ledger.memberProfiles[tr.toUid]?.displayName ?? tr.toUid;
                  return (
                    <div
                      key={`${tr.fromUid}-${tr.toUid}`}
                      data-testid="suggested-transfer-item"
                      className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3"
                    >
                      <div className="text-sm font-medium text-slate-900">
                        <span className="text-rose-700 font-semibold">
                          {fromName}
                        </span>{" "}
                        應支付給{" "}
                        <span className="text-emerald-700 font-semibold">
                          {toName}
                        </span>
                      </div>
                      <Badge variant="success">
                        {formatCurrencyInteger(tr.amount, ledger.currency)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Story 7：標記還款 */}
      <Card>
        <CardHeader>
          <CardTitle>標記已還款</CardTitle>
          <CardDescription>
            輸入還款金額並選擇收款對象，送出後將通知收款人確認
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(netBalances[currentUserUid] ?? 0) < 0 ? (
            <form
              onSubmit={handleRepaySubmit}
              className="grid gap-4 sm:grid-cols-4 sm:items-end"
            >
            <div>
              <span className="mb-1 block text-xs font-medium text-slate-700">
                還款人（目前登入會員）
              </span>
              <p className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                {ledger.memberProfiles[currentUserUid]?.displayName ??
                  currentUserUid}
              </p>
            </div>

            <div>
              <label
                htmlFor="repay-to-select"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                收款對象
              </label>
              <select
                id="repay-to-select"
                value={toUid}
                onChange={(e) => setToUid(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {ledger.members
                  .filter((uid) => uid !== currentUserUid)
                  .map((uid) => (
                  <option key={uid} value={uid}>
                    {ledger.memberProfiles[uid]?.displayName ?? uid}
                  </option>
                  ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="repay-amount-input"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                還款金額
              </label>
              <Input
                id="repay-amount-input"
                type="number"
                min="1"
                max="1000000000000"
                step="1"
                placeholder="輸入還款金額"
                value={repayAmountStr}
                onChange={(e) => setRepayAmountStr(e.target.value)}
              />
            </div>

            <Button type="submit">確認還款</Button>
            </form>
          ) : (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              您目前沒有待還款項。
            </p>
          )}

          {/* 還款紀錄列表與收款人確認按鈕 */}
          {repayments.length > 0 && (
            <div className="mt-6 space-y-2 border-t border-slate-200 pt-4">
              <h4 className="text-sm font-semibold text-slate-900">
                還款紀錄列表
              </h4>
              {repayments.map((rep) => {
                const fromName =
                  ledger.memberProfiles[rep.fromUid]?.displayName ??
                  rep.fromUid;
                const toName =
                  ledger.memberProfiles[rep.toUid]?.displayName ?? rep.toUid;
                return (
                  <div
                    key={rep.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm"
                  >
                    <div>
                      <span className="font-medium text-slate-900">
                        {fromName} 還款給 {toName}：{rep.amount} 元
                      </span>
                      <span className="ml-2">
                        <Badge
                          variant={
                            rep.status === "confirmed" ? "success" : "secondary"
                          }
                        >
                          {rep.status === "confirmed"
                            ? "收款人已確認"
                            : "待收款人確認"}
                        </Badge>
                      </span>
                    </div>

                    {rep.status === "pending" &&
                      rep.toUid === currentUserUid && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onConfirmRepayment(rep.id)}
                      >
                        收款人確認收款
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
