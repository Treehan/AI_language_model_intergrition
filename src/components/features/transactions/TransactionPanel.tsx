"use client";

/**
 * 記帳、分帳方式選擇與支出管理 UI 元件 (components/features/transactions/)
 * 涵蓋 User Story 4 (新增支出)、User Story 5 (選擇分帳方式：平均分攤 / 指定金額)、User Story 8 (管理群組支出)
 * 遵循 ARCHITECTURE.md 第三大支柱：純 UI 元件僅透過 props 接收資料與事件回呼。
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
import type { Ledger, LedgerRole } from "@/types/ledger";
import type {
  ExpenseCategory,
  SplitMethod,
  Transaction,
} from "@/types/transaction";

export interface ExpenseSubmissionPayload {
  title: string;
  amount: number;
  payerId: string;
  date: string;
  category: ExpenseCategory;
  splitMethod: SplitMethod;
  participants: string[];
  customSplits: Record<string, number>;
}

export interface TransactionPanelProps {
  ledger: Ledger;
  transactions: Transaction[];
  currentUserUid: string;
  currentUserRole: LedgerRole;
  feedbackError?: string | null;
  feedbackSuccess?: string | null;
  onAddExpense: (
    payload: ExpenseSubmissionPayload,
  ) => boolean | Promise<boolean>;
  onUpdateExpense: (
    transactionId: string,
    payload: ExpenseSubmissionPayload,
  ) => boolean | Promise<boolean>;
  onDeleteExpense: (transactionId: string) => void | Promise<void>;
}

const CATEGORIES: ExpenseCategory[] = [
  "餐飲",
  "交通",
  "住宿",
  "娛樂",
  "購物",
  "其他",
];

export function TransactionPanel({
  ledger,
  transactions,
  currentUserUid,
  currentUserRole,
  feedbackError,
  feedbackSuccess,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}: TransactionPanelProps) {
  const [editingTxId, setEditingTxId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [amountStr, setAmountStr] = React.useState("");
  const [payerId, setPayerId] = React.useState(currentUserUid);
  const [date, setDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [category, setCategory] = React.useState<ExpenseCategory>("餐飲");
  const [splitMethod, setSplitMethod] = React.useState<SplitMethod>("equal");
  const [participants, setParticipants] = React.useState<string[]>(
    ledger.members,
  );
  const [customSplitStrs, setCustomSplitStrs] = React.useState<
    Record<string, string>
  >({});

  const canManageAll =
    currentUserRole === "Owner" || currentUserRole === "Editor";

  const toggleParticipant = (uid: string) => {
    setParticipants((prev) =>
      prev.includes(uid) ? prev.filter((item) => item !== uid) : [...prev, uid],
    );
  };

  const handleStartEdit = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setTitle(tx.title);
    setAmountStr(String(tx.amount));
    setPayerId(tx.payerId);
    setDate(tx.date);
    setCategory(tx.category);
    setSplitMethod(tx.splitMethod);
    setParticipants(tx.participants);
    const nextCustom: Record<string, string> = {};
    for (const [uid, val] of Object.entries(tx.splits)) {
      nextCustom[uid] = String(val);
    }
    setCustomSplitStrs(nextCustom);
  };

  const handleCancelEdit = () => {
    setEditingTxId(null);
    setTitle("");
    setAmountStr("");
    setSplitMethod("equal");
    setParticipants(ledger.members);
    setCustomSplitStrs({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = amountStr.trim() === "" ? 0 : Number(amountStr.trim());
    const customSplits: Record<string, number> = {};
    for (const uid of participants) {
      const rawVal = customSplitStrs[uid]?.trim() ?? "0";
      const parsedVal = rawVal === "" ? 0 : Number(rawVal);
      customSplits[uid] = Number.isNaN(parsedVal) ? 0 : parsedVal;
    }

    const payload: ExpenseSubmissionPayload = {
      title,
      amount: Number.isNaN(parsedAmount) ? 0 : parsedAmount,
      payerId,
      date,
      category,
      splitMethod,
      participants,
      customSplits,
    };

    if (editingTxId) {
      const ok = await onUpdateExpense(editingTxId, payload);
      if (ok) {
        handleCancelEdit();
      }
    } else {
      const ok = await onAddExpense(payload);
      if (ok) {
        setTitle("");
        setAmountStr("");
        setCustomSplitStrs({});
      }
    }
  };

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

      {/* 新增 / 修改支出表單 */}
      <Card>
        <CardHeader>
          <CardTitle>{editingTxId ? "修改支出" : "新增支出"}</CardTitle>
          <CardDescription>
            所有金額皆以整數計算，支援「平均分攤（自動分配零頭）」與「指定金額」
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="expense-title-input"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  項目名稱
                </label>
                <Input
                  id="expense-title-input"
                  placeholder="例如：海鮮合菜晚餐"
                  value={title}
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="expense-amount-input"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  金額（整數 {ledger.currency}）
                </label>
                <Input
                  id="expense-amount-input"
                  type="number"
                  min="1"
                  max="1000000000000"
                  step="1"
                  placeholder="請輸入正整數金額，例如 1000"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="expense-payer-select"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  付款人
                </label>
                <select
                  id="expense-payer-select"
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {ledger.members.map((uid) => (
                    <option key={uid} value={uid}>
                      {ledger.memberProfiles[uid]?.displayName ?? uid}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="expense-category-select"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  類別
                </label>
                <select
                  id="expense-category-select"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as ExpenseCategory)
                  }
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="expense-date-input"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  日期
                </label>
                <Input
                  id="expense-date-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {/* 分帳方式選擇 (User Story 5) */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-700">
                分帳方式
              </span>
              <div className="flex gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant={splitMethod === "equal" ? "default" : "outline"}
                  onClick={() => setSplitMethod("equal")}
                >
                  平均分攤
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={splitMethod === "custom" ? "default" : "outline"}
                  onClick={() => setSplitMethod("custom")}
                >
                  指定金額
                </Button>
              </div>
            </div>

            {/* 分攤成員勾選與指定金額輸入 */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-700">
                選擇分攤成員
              </span>
              <div className="grid gap-2 sm:grid-cols-2">
                {ledger.members.map((uid) => {
                  const checked = participants.includes(uid);
                  const displayName =
                    ledger.memberProfiles[uid]?.displayName ?? uid;

                  return (
                    <div
                      key={uid}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleParticipant(uid)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        />
                        {displayName}
                      </label>

                      {splitMethod === "custom" && checked && (
                        <div className="w-28">
                          <Input
                            type="number"
                              min="0"
                              max="1000000000000"
                            step="1"
                            aria-label={`${displayName}分攤金額`}
                            placeholder="金額"
                            value={customSplitStrs[uid] ?? ""}
                            onChange={(e) =>
                              setCustomSplitStrs((prev) => ({
                                ...prev,
                                [uid]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit">儲存</Button>
              {editingTxId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                >
                  取消修改
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 群組帳目列表 (User Story 4, 5, 8) */}
      <Card>
        <CardHeader>
          <CardTitle>群組帳目列表（共 {transactions.length} 筆）</CardTitle>
          <CardDescription>
            顯示每一筆支出的付款人、類別、各成員分攤明細與修改紀錄
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              目前尚無支出紀錄，請由上方表單新增第一筆支出。
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const payerName =
                  ledger.memberProfiles[tx.payerId]?.displayName ?? tx.payerId;

                return (
                  <div
                    key={tx.id}
                    data-testid={`transaction-item-${tx.id}`}
                    className="rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50/60"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-slate-900">
                            {tx.title}
                          </span>
                          <Badge variant="secondary">{tx.category}</Badge>
                          <Badge variant="outline">
                            {tx.splitMethod === "equal"
                              ? "平均分攤"
                              : "指定金額"}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600">
                          日期：{tx.date} ｜ 付款人：
                          <strong>{payerName}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-slate-900">
                          {formatCurrencyInteger(tx.amount, ledger.currency)}
                        </span>
                        {canManageAll && (
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              aria-label={`修改${tx.title}`}
                              onClick={() => handleStartEdit(tx)}
                            >
                              修改
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              aria-label={`刪除${tx.title}`}
                              onClick={() => onDeleteExpense(tx.id)}
                            >
                              刪除
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 分攤明細 */}
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
                      <span className="font-medium text-slate-700">
                        分攤明細：
                      </span>
                      {Object.entries(tx.splits).map(([uid, share]) => (
                        <span
                          key={uid}
                          className="rounded bg-slate-100 px-2 py-0.5 text-slate-800"
                        >
                          {ledger.memberProfiles[uid]?.displayName ?? uid}：
                          {share} 元
                        </span>
                      ))}
                    </div>

                    {/* 修改歷史紀錄 (User Story 8) */}
                    {tx.history.length > 0 && (
                      <div className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
                        修改紀錄：原為「
                        {tx.history[tx.history.length - 1]?.previousTitle}」（
                        {tx.history[tx.history.length - 1]?.previousAmount} 元）
                      </div>
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
