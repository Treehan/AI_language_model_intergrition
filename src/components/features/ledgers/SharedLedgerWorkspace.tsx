"use client";

/**
 * 應用程式主工作區容器
 * 負載狀態管理、計算結果並將純資料與回呼傳遞給 components/features/* 下的純顯示元件
 */
import * as React from "react";
import { AppHeader } from "@/components/common/Header";
import { LedgerGroupPanel } from "@/components/features/ledgers/LedgerGroupPanel";
import { SettlementAndStatsPanel } from "@/components/features/settlements/SettlementAndStatsPanel";
import {
  type ExpenseSubmissionPayload,
  TransactionPanel,
} from "@/components/features/transactions/TransactionPanel";
import { Button } from "@/components/ui/button";
import {
  calculateExpenseStatistics,
  calculateNetBalances,
  simplifyDebts,
} from "@/lib/finance";
import {
  addExpenseInState,
  type AppDatabaseState,
  confirmRepaymentInState,
  createInitialAppState,
  createLedgerInState,
  createRepaymentInState,
  deleteAccountInState,
  deleteExpenseInState,
  joinLedgerByInviteInState,
  loginAccountInState,
  registerAccountInState,
  removeMemberFromLedgerInState,
  saveAppState,
  toggleLedgerInviteInState,
  updateExpenseInState,
} from "@/lib/ledgers";
import type { CurrencyCode } from "@/types/ledger";

type WorkspaceTab = "expenses" | "settlement" | "statistics" | "group";

export function SharedLedgerWorkspace() {
  const [appState, setAppState] = React.useState<AppDatabaseState>(() =>
    createInitialAppState(),
  );
  const [activeLedgerId, setActiveLedgerId] = React.useState<string>(
    "ledger-taipei-trip",
  );
  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>("expenses");
  const [feedbackError, setFeedbackError] = React.useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = React.useState<string | null>(
    null,
  );
  const [statsStartDate, setStatsStartDate] =
    React.useState<string>("2026-11-01");
  const [statsEndDate, setStatsEndDate] = React.useState<string>("2026-12-31");

  const clearFeedback = () => {
    setFeedbackError(null);
    setFeedbackSuccess(null);
  };

  const currentUser = appState.currentUserUid
    ? (appState.users[appState.currentUserUid] ?? null)
    : null;
  const allUsers = Object.values(appState.users);

  // 使用者參與的帳本列表
  const userLedgers = Object.values(appState.ledgers).filter((l) =>
    currentUser ? l.members.includes(currentUser.uid) : true,
  );

  const activeLedger =
    appState.ledgers[activeLedgerId] ??
    userLedgers[0] ??
    Object.values(appState.ledgers)[0]!;

  const currentUserUid = currentUser?.uid ?? activeLedger.members[0] ?? "";
  const currentUserRole =
    activeLedger.roles[currentUserUid] ?? "Member";

  const activeTransactions = React.useMemo(
    () => appState.transactions[activeLedger.id] ?? [],
    [appState.transactions, activeLedger.id],
  );
  const activeRepayments = React.useMemo(
    () => appState.repayments[activeLedger.id] ?? [],
    [appState.repayments, activeLedger.id],
  );

  // 呼叫 lib/finance 純函式計算淨額、最少轉帳建議與統計資料
  const netBalances = React.useMemo(
    () =>
      calculateNetBalances(
        activeLedger.members,
        activeTransactions,
        activeRepayments,
      ),
    [activeLedger.members, activeTransactions, activeRepayments],
  );

  const suggestedTransfers = React.useMemo(
    () => simplifyDebts(netBalances),
    [netBalances],
  );

  const statistics = React.useMemo(
    () =>
      calculateExpenseStatistics({
        transactions: activeTransactions,
        userUid: currentUserUid,
        startDate: statsStartDate || undefined,
        endDate: statsEndDate || undefined,
      }),
    [activeTransactions, currentUserUid, statsStartDate, statsEndDate],
  );

  // 處理帳號註冊與登入 (User Story 1)
  const handleRegisterAccount = (params: {
    identifier: string;
    password: string;
    displayName: string;
  }): boolean => {
    clearFeedback();
    const res = registerAccountInState(appState, params);
    if (res.error) {
      setFeedbackError(res.error);
      return false;
    }
    // 將新註冊帳號自動加入預設旅遊帳本以便體驗
    const nextState = res.nextState;
    const newUid = nextState.currentUserUid!;
    const defaultLedger = nextState.ledgers["ledger-taipei-trip"];
    if (defaultLedger && !defaultLedger.members.includes(newUid)) {
      defaultLedger.members = [...defaultLedger.members, newUid];
      defaultLedger.roles[newUid] = "Editor";
      defaultLedger.memberProfiles[newUid] = {
        uid: newUid,
        displayName: res.user!.displayName,
        email: res.user!.email,
        joinedAt: new Date().toISOString(),
      };
    }
    setAppState({ ...nextState });
    setFeedbackSuccess(`歡迎 ${res.user?.displayName}！已成功建立帳號並自動登入`);
    return true;
  };

  const handleLoginAccount = (params: {
    identifier: string;
    password: string;
  }): boolean => {
    clearFeedback();
    const res = loginAccountInState(appState, params);
    if (res.error) {
      setFeedbackError(res.error);
      return false;
    }
    setAppState(res.nextState);
    setFeedbackSuccess(`歡迎回來，${res.user?.displayName}！`);
    return true;
  };

  const handleSwitchUser = (uid: string) => {
    clearFeedback();
    const next = { ...appState, currentUserUid: uid };
    saveAppState(next);
    setAppState(next);
  };

  const handleLogout = () => {
    clearFeedback();
    const next = { ...appState, currentUserUid: null };
    saveAppState(next);
    setAppState(next);
  };

  const handleDeleteAccount = (): boolean => {
    clearFeedback();
    const res = deleteAccountInState(appState);
    if (res.error) {
      setFeedbackError(res.error);
      return false;
    }
    setAppState(res.nextState);
    setFeedbackSuccess(`已成功刪除帳號「${res.deletedUserName}」並退出相關群組`);
    return true;
  };

  // User Story 2：建立記帳群組
  const handleCreateLedger = (name: string, currency: CurrencyCode) => {
    clearFeedback();
    const res = createLedgerInState(appState, { name, currency });
    if (res.error || !res.ledger) {
      setFeedbackError(res.error ?? "建立群組失敗");
      return;
    }
    setAppState(res.nextState);
    setActiveLedgerId(res.ledger.id);
    setFeedbackSuccess(
      `已成功建立群組「${res.ledger.name}」，並產生專屬邀請連結與 QR Code！`,
    );
  };

  // User Story 3：透過邀請連結加入群組
  const handleJoinLedger = (inviteCodeOrUrl: string) => {
    clearFeedback();
    const res = joinLedgerByInviteInState(appState, inviteCodeOrUrl);
    if (res.error || !res.ledger) {
      setFeedbackError(res.error ?? "加入群組失敗");
      return;
    }
    setAppState(res.nextState);
    setActiveLedgerId(res.ledger.id);
    setFeedbackSuccess(`已成功加入群組「${res.ledger.name}」！`);
  };

  const handleToggleInvite = (ledgerId: string, active: boolean) => {
    clearFeedback();
    const res = toggleLedgerInviteInState(appState, ledgerId, active);
    if (res.error) {
      setFeedbackError(res.error);
      return;
    }
    setAppState(res.nextState);
    setFeedbackSuccess(active ? "已重新啟用邀請連結" : "已關閉邀請連結");
  };

  // User Story 4 & 5：新增支出
  const handleAddExpense = (payload: ExpenseSubmissionPayload): boolean => {
    clearFeedback();
    const res = addExpenseInState(appState, {
      ledgerId: activeLedger.id,
      ...payload,
    });
    if (res.error) {
      setFeedbackError(res.error);
      return false;
    }
    setAppState(res.nextState);
    setFeedbackSuccess(
      `已儲存支出「${res.transaction?.title}」（${res.transaction?.amount} 元），各成員餘額已自動更新並發送通知`,
    );
    return true;
  };

  // User Story 8：修改與刪除群組支出
  const handleUpdateExpense = (
    transactionId: string,
    payload: ExpenseSubmissionPayload,
  ): boolean => {
    clearFeedback();
    const res = updateExpenseInState(appState, {
      ledgerId: activeLedger.id,
      transactionId,
      ...payload,
    });
    if (res.error) {
      setFeedbackError(res.error);
      return false;
    }
    setAppState(res.nextState);
    setFeedbackSuccess(
      `已更新支出「${res.transaction?.title}」，保留修改紀錄並重新計算各成員餘額`,
    );
    return true;
  };

  const handleDeleteExpense = (transactionId: string) => {
    clearFeedback();
    const res = deleteExpenseInState(appState, {
      ledgerId: activeLedger.id,
      transactionId,
    });
    if (res.error) {
      setFeedbackError(res.error);
      return;
    }
    setAppState(res.nextState);
    setFeedbackSuccess("已刪除支出並重新計算各成員餘額");
  };

  // User Story 7：標記還款與確認收款
  const handleCreateRepayment = (
    fromUid: string,
    toUid: string,
    amount: number,
  ) => {
    clearFeedback();
    const res = createRepaymentInState(appState, {
      ledgerId: activeLedger.id,
      fromUid,
      toUid,
      amount,
    });
    if (res.error) {
      setFeedbackError(res.error);
      return;
    }
    setAppState(res.nextState);
    setFeedbackSuccess("已標記還款並通知收款人確認！");
  };

  const handleConfirmRepayment = (repaymentId: string) => {
    clearFeedback();
    const res = confirmRepaymentInState(appState, {
      ledgerId: activeLedger.id,
      repaymentId,
    });
    if (res.error) {
      setFeedbackError(res.error);
      return;
    }
    setAppState(res.nextState);
    setFeedbackSuccess("收款人已確認收款，雙方餘額已即時更新！");
  };

  // User Story 9：移除群組成員
  const handleRemoveMember = (ledgerId: string, targetUid: string) => {
    clearFeedback();
    const res = removeMemberFromLedgerInState(appState, {
      ledgerId,
      targetUid,
    });
    if (res.error) {
      setFeedbackError(res.error);
      return;
    }
    setAppState(res.nextState);
    setFeedbackSuccess("已將該成員移出群組並發送通知");
  };

  const ledgerNotifications = appState.notifications
    .filter((n) => n.ledgerId === activeLedger.id)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader
        currentUser={currentUser}
        allUsers={allUsers}
        authError={feedbackError}
        authSuccess={feedbackSuccess}
        onRegisterAccount={handleRegisterAccount}
        onLoginAccount={handleLoginAccount}
        onDeleteAccount={handleDeleteAccount}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* 頂部帳本快速概覽與導覽頁籤 */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                目前作用中帳本
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                幣別：{activeLedger.currency}
              </span>
            </div>
            <h2
              data-testid="active-ledger-title"
              className="mt-1 text-2xl font-bold text-slate-900"
            >
              {activeLedger.name}
            </h2>
          </div>

          <nav
            aria-label="帳本功能導覽"
            className="flex flex-wrap items-center gap-2"
          >
            <Button
              type="button"
              variant={activeTab === "expenses" ? "default" : "outline"}
              onClick={() => {
                clearFeedback();
                setActiveTab("expenses");
              }}
            >
              帳目與新增支出
            </Button>
            <Button
              type="button"
              variant={activeTab === "settlement" ? "default" : "outline"}
              onClick={() => {
                clearFeedback();
                setActiveTab("settlement");
              }}
            >
              結算
            </Button>
            <Button
              type="button"
              variant={activeTab === "statistics" ? "default" : "outline"}
              onClick={() => {
                clearFeedback();
                setActiveTab("statistics");
              }}
            >
              統計
            </Button>
            <Button
              type="button"
              variant={activeTab === "group" ? "default" : "outline"}
              onClick={() => {
                clearFeedback();
                setActiveTab("group");
              }}
            >
              群組與成員管理
            </Button>
          </nav>
        </div>

        {/* 即時系統通知列 */}
        {ledgerNotifications.length > 0 && (
          <div
            aria-label="系統最新通知"
            className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-blue-900"
          >
            <span className="font-semibold">最新群組通知：</span>{" "}
            {ledgerNotifications[0]?.message}
          </div>
        )}

        {/* 功能內容區 */}
        {activeTab === "expenses" && (
          <TransactionPanel
            key={`${activeLedger.id}-${currentUserUid}`}
            ledger={activeLedger}
            transactions={activeTransactions}
            currentUserUid={currentUserUid}
            currentUserRole={currentUserRole}
            feedbackError={feedbackError}
            feedbackSuccess={feedbackSuccess}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        )}

        {activeTab === "settlement" && (
          <SettlementAndStatsPanel
            key={`settlement-${activeLedger.id}-${currentUserUid}`}
            mode="settlement"
            ledger={activeLedger}
            currentUserUid={currentUserUid}
            netBalances={netBalances}
            suggestedTransfers={suggestedTransfers}
            repayments={activeRepayments}
            statistics={statistics}
            startDate={statsStartDate}
            endDate={statsEndDate}
            feedbackError={feedbackError}
            feedbackSuccess={feedbackSuccess}
            onChangeDateRange={(s, e) => {
              setStatsStartDate(s);
              setStatsEndDate(e);
            }}
            onCreateRepayment={handleCreateRepayment}
            onConfirmRepayment={handleConfirmRepayment}
          />
        )}

        {activeTab === "statistics" && (
          <SettlementAndStatsPanel
            mode="statistics"
            ledger={activeLedger}
            currentUserUid={currentUserUid}
            netBalances={netBalances}
            suggestedTransfers={suggestedTransfers}
            repayments={activeRepayments}
            statistics={statistics}
            startDate={statsStartDate}
            endDate={statsEndDate}
            feedbackError={feedbackError}
            feedbackSuccess={feedbackSuccess}
            onChangeDateRange={(s, e) => {
              setStatsStartDate(s);
              setStatsEndDate(e);
            }}
            onCreateRepayment={handleCreateRepayment}
            onConfirmRepayment={handleConfirmRepayment}
          />
        )}

        {activeTab === "group" && (
          <LedgerGroupPanel
            ledgers={userLedgers}
            activeLedger={activeLedger}
            currentUserUid={currentUserUid}
            currentUserRole={currentUserRole}
            netBalances={netBalances}
            feedbackError={feedbackError}
            feedbackSuccess={feedbackSuccess}
            onSelectLedger={(id) => {
              clearFeedback();
              setActiveLedgerId(id);
            }}
            onCreateLedger={handleCreateLedger}
            onJoinLedger={handleJoinLedger}
            onToggleInviteActive={handleToggleInvite}
            onRemoveMember={handleRemoveMember}
          />
        )}
      </main>
    </div>
  );
}
