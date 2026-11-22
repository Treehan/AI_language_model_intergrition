"use client";

import { onAuthStateChanged } from "firebase/auth";
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
  createEmptyAppState,
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
import {
  getFirebaseAuthErrorMessage,
  getOrCreateFirebaseUserProfile,
  registerFirebaseAccount,
  signInFirebaseAccount,
  signOutFirebaseAccount,
} from "@/lib/firebase/auth";
import { getFirebaseClientAuth, isFirebaseEnabled } from "@/lib/firebase/client";
import {
  createFirebaseDocumentId,
  joinFirebaseLedgerByInvite,
  persistAppStateChanges,
  subscribeToFirebaseWorkspace,
} from "@/lib/firebase/workspace";
import type { CurrencyCode } from "@/types/ledger";

type WorkspaceTab = "expenses" | "settlement" | "statistics" | "group";

export function SharedLedgerWorkspace() {
  const firebaseMode = isFirebaseEnabled();
  const [appState, setAppState] = React.useState<AppDatabaseState>(() =>
    firebaseMode ? createEmptyAppState() : createInitialAppState(),
  );
  const [activeLedgerId, setActiveLedgerId] = React.useState<string>(
    firebaseMode ? "" : "ledger-taipei-trip",
  );
  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>(
    firebaseMode ? "group" : "expenses",
  );
  const [firebaseReady, setFirebaseReady] = React.useState(!firebaseMode);
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

  React.useEffect(() => {
    if (!firebaseMode) {
      return;
    }

    let disposed = false;
    let unsubscribeWorkspace: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(
      getFirebaseClientAuth(),
      (firebaseUser) => {
        unsubscribeWorkspace?.();
        unsubscribeWorkspace = undefined;

        if (!firebaseUser) {
          setAppState(createEmptyAppState());
          setActiveLedgerId("");
          setFirebaseReady(true);
          return;
        }

        setFirebaseReady(false);
        void getOrCreateFirebaseUserProfile(firebaseUser)
          .then((profile) => {
            if (
              disposed ||
              getFirebaseClientAuth().currentUser?.uid !== firebaseUser.uid
            ) {
              return;
            }
            unsubscribeWorkspace = subscribeToFirebaseWorkspace(
              firebaseUser.uid,
              profile,
              (state) => {
                if (!disposed) {
                  setAppState(state);
                  setFirebaseReady(true);
                }
              },
              (error) => {
                if (!disposed) {
                  setFeedbackError(getFirebaseAuthErrorMessage(error));
                  setFirebaseReady(true);
                }
              },
            );
          })
          .catch((error: unknown) => {
            if (!disposed) {
              setFeedbackError(getFirebaseAuthErrorMessage(error));
              setFirebaseReady(true);
            }
          });
      },
      (error) => {
        setFeedbackError(getFirebaseAuthErrorMessage(error));
        setFirebaseReady(true);
      },
    );

    return () => {
      disposed = true;
      unsubscribeWorkspace?.();
      unsubscribeAuth();
    };
  }, [firebaseMode]);

  const persistNextState = async (
    nextState: AppDatabaseState,
  ): Promise<boolean> => {
    try {
      if (firebaseMode) {
        await persistAppStateChanges(appState, nextState);
      } else {
        saveAppState(nextState);
      }
      setAppState(nextState);
      return true;
    } catch (error) {
      setFeedbackError(getFirebaseAuthErrorMessage(error));
      return false;
    }
  };

  const currentUser = appState.currentUserUid
    ? (appState.users[appState.currentUserUid] ?? null)
    : null;
  const allUsers = Object.values(appState.users);

  // 使用者參與的帳本列表
  const userLedgers = Object.values(appState.ledgers).filter((l) =>
    currentUser ? l.members.includes(currentUser.uid) : !firebaseMode,
  );

  const activeLedger =
    appState.ledgers[activeLedgerId] ??
    userLedgers[0] ??
    (firebaseMode ? null : Object.values(appState.ledgers)[0] ?? null);
  const selectedLedgerId = activeLedger?.id;

  const currentUserUid = currentUser?.uid ?? activeLedger?.members[0] ?? "";
  const currentUserRole =
    activeLedger?.roles[currentUserUid] ?? "Member";

  const activeTransactions = React.useMemo(
    () =>
      selectedLedgerId
        ? appState.transactions[selectedLedgerId] ?? []
        : [],
    [appState.transactions, selectedLedgerId],
  );
  const activeRepayments = React.useMemo(
    () =>
      selectedLedgerId
        ? appState.repayments[selectedLedgerId] ?? []
        : [],
    [appState.repayments, selectedLedgerId],
  );

  // 呼叫 lib/finance 純函式計算淨額、最少轉帳建議與統計資料
  const netBalances = React.useMemo(
    () =>
      calculateNetBalances(
        activeLedger?.members ?? [],
        activeTransactions,
        activeRepayments,
      ),
    [activeLedger?.members, activeTransactions, activeRepayments],
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
  const handleRegisterAccount = async (params: {
    identifier: string;
    password: string;
    displayName: string;
  }): Promise<boolean> => {
    clearFeedback();
    if (firebaseMode) {
      if (!params.identifier.includes("@")) {
        setFeedbackError("Firebase 登入目前請使用電子郵件地址");
        return false;
      }
      if (!params.displayName.trim()) {
        setFeedbackError("請輸入暱稱");
        return false;
      }
      try {
        const user = await registerFirebaseAccount({
          email: params.identifier,
          password: params.password,
          displayName: params.displayName,
        });
        setFeedbackSuccess(`歡迎 ${user.displayName}！已成功建立帳號並登入`);
        return true;
      } catch (error) {
        setFeedbackError(getFirebaseAuthErrorMessage(error));
        return false;
      }
    }

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

  const handleLoginAccount = async (params: {
    identifier: string;
    password: string;
  }): Promise<boolean> => {
    clearFeedback();
    if (firebaseMode) {
      try {
        await signInFirebaseAccount(params.identifier, params.password);
        setFeedbackSuccess("登入成功");
        return true;
      } catch (error) {
        setFeedbackError(getFirebaseAuthErrorMessage(error));
        return false;
      }
    }

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

  const handleLogout = async () => {
    clearFeedback();
    if (firebaseMode) {
      try {
        await signOutFirebaseAccount();
      } catch (error) {
        setFeedbackError(getFirebaseAuthErrorMessage(error));
      }
      return;
    }
    const next = { ...appState, currentUserUid: null };
    saveAppState(next);
    setAppState(next);
  };

  const handleDeleteAccount = (): boolean => {
    clearFeedback();
    if (firebaseMode) {
      setFeedbackError("Firebase 帳號刪除需先完成安全的群組資料處理，目前尚未開放");
      return false;
    }
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
  const handleCreateLedger = async (
    name: string,
    currency: CurrencyCode,
  ): Promise<boolean> => {
    clearFeedback();
    const res = createLedgerInState(appState, {
      name,
      currency,
      ...(firebaseMode
        ? {
            id: createFirebaseDocumentId("ledgers"),
            inviteCode: `INV-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
          }
        : {}),
    });
    if (res.error || !res.ledger) {
      setFeedbackError(res.error ?? "建立群組失敗");
      return false;
    }
    if (!(await persistNextState(res.nextState))) {
      return false;
    }
    setActiveLedgerId(res.ledger.id);
    setFeedbackSuccess(
      `已成功建立群組「${res.ledger.name}」，並產生專屬邀請連結與 QR Code！`,
    );
    return true;
  };

  // User Story 3：透過邀請連結加入群組
  const handleJoinLedger = async (inviteCodeOrUrl: string) => {
    clearFeedback();
    if (firebaseMode) {
      if (!currentUser) {
        setFeedbackError("請先登入再加入群組");
        return;
      }
      try {
        const inviteUrl = new URL(inviteCodeOrUrl.trim());
        const ledgerId = inviteUrl.searchParams.get("ledger");
        if (!ledgerId) {
          setFeedbackError("請貼上完整的群組邀請連結");
          return;
        }
        await joinFirebaseLedgerByInvite({
          ledgerId,
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          email: currentUser.email,
        });
        setActiveLedgerId(ledgerId);
        setFeedbackSuccess("已成功加入群組！");
      } catch (error) {
        setFeedbackError(
          error instanceof Error && "code" in error && error.code === "permission-denied"
            ? "此邀請連結已失效，請向群組管理者索取新連結"
            : getFirebaseAuthErrorMessage(error),
        );
      }
      return;
    }
    const res = joinLedgerByInviteInState(appState, inviteCodeOrUrl);
    if (res.error || !res.ledger) {
      setFeedbackError(res.error ?? "加入群組失敗");
      return;
    }
    setAppState(res.nextState);
    setActiveLedgerId(res.ledger.id);
    setFeedbackSuccess(`已成功加入群組「${res.ledger.name}」！`);
  };

  const handleToggleInvite = async (ledgerId: string, active: boolean) => {
    clearFeedback();
    const res = toggleLedgerInviteInState(appState, ledgerId, active);
    if (res.error) {
      setFeedbackError(res.error);
      return;
    }
    if (!(await persistNextState(res.nextState))) {
      return;
    }
    setFeedbackSuccess(active ? "已重新啟用邀請連結" : "已關閉邀請連結");
  };

  // User Story 4 & 5：新增支出
  const handleAddExpense = async (
    payload: ExpenseSubmissionPayload,
  ): Promise<boolean> => {
    clearFeedback();
    if (!activeLedger) {
      setFeedbackError("請先建立或加入群組再新增支出");
      return false;
    }
    const res = addExpenseInState(appState, {
      ledgerId: activeLedger.id,
      ...payload,
    });
    if (res.error) {
      setFeedbackError(res.error);
      return false;
    }
    if (!(await persistNextState(res.nextState))) {
      return false;
    }
    setFeedbackSuccess(
      `已儲存支出「${res.transaction?.title}」（${res.transaction?.amount} 元），各成員餘額已自動更新並發送通知`,
    );
    return true;
  };

  // User Story 8：修改與刪除群組支出
  const handleUpdateExpense = async (
    transactionId: string,
    payload: ExpenseSubmissionPayload,
  ): Promise<boolean> => {
    clearFeedback();
    if (!activeLedger) {
      setFeedbackError("請先建立或加入群組再修改支出");
      return false;
    }
    const res = updateExpenseInState(appState, {
      ledgerId: activeLedger.id,
      transactionId,
      ...payload,
    });
    if (res.error) {
      setFeedbackError(res.error);
      return false;
    }
    if (!(await persistNextState(res.nextState))) {
      return false;
    }
    setFeedbackSuccess(
      `已更新支出「${res.transaction?.title}」，保留修改紀錄並重新計算各成員餘額`,
    );
    return true;
  };

  const handleDeleteExpense = async (transactionId: string) => {
    clearFeedback();
    if (!activeLedger) {
      setFeedbackError("請先建立或加入群組再刪除支出");
      return;
    }
    const res = deleteExpenseInState(appState, {
      ledgerId: activeLedger.id,
      transactionId,
    });
    if (res.error) {
      setFeedbackError(res.error);
      return;
    }
    if (!(await persistNextState(res.nextState))) {
      return;
    }
    setFeedbackSuccess("已刪除支出並重新計算各成員餘額");
  };

  // User Story 7：標記還款與確認收款
  const handleCreateRepayment = async (
    fromUid: string,
    toUid: string,
    amount: number,
  ) => {
    clearFeedback();
    if (!activeLedger) {
      setFeedbackError("請先建立或加入群組再標記還款");
      return;
    }
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
    if (!(await persistNextState(res.nextState))) {
      return;
    }
    setFeedbackSuccess("已標記還款並通知收款人確認！");
  };

  const handleConfirmRepayment = async (repaymentId: string) => {
    clearFeedback();
    if (!activeLedger) {
      setFeedbackError("請先建立或加入群組再確認還款");
      return;
    }
    const res = confirmRepaymentInState(appState, {
      ledgerId: activeLedger.id,
      repaymentId,
    });
    if (res.error) {
      setFeedbackError(res.error);
      return;
    }
    if (!(await persistNextState(res.nextState))) {
      return;
    }
    setFeedbackSuccess("收款人已確認收款，雙方餘額已即時更新！");
  };

  // User Story 9：移除群組成員
  const handleRemoveMember = async (ledgerId: string, targetUid: string) => {
    clearFeedback();
    const res = removeMemberFromLedgerInState(appState, {
      ledgerId,
      targetUid,
    });
    if (res.error) {
      setFeedbackError(res.error);
      return;
    }
    if (!(await persistNextState(res.nextState))) {
      return;
    }
    setFeedbackSuccess("已將該成員移出群組並發送通知");
  };

  const ledgerNotifications = appState.notifications
    .filter((n) => n.ledgerId === activeLedger?.id)
    .slice(0, 3);

  if (firebaseMode && !firebaseReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        正在連線至 Firebase…
      </main>
    );
  }

  const visibleTab: WorkspaceTab = activeLedger ? activeTab : "group";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader
        currentUser={currentUser}
        allUsers={allUsers}
        firebaseMode={firebaseMode}
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
              {activeLedger && (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  幣別：{activeLedger.currency}
                </span>
              )}
            </div>
            <h2
              data-testid="active-ledger-title"
              className="mt-1 text-2xl font-bold text-slate-900"
            >
              {activeLedger?.name ?? "尚未加入群組"}
            </h2>
          </div>

          <nav
            aria-label="帳本功能導覽"
            className="flex flex-wrap items-center gap-2"
          >
            {activeLedger && <Button
              type="button"
              variant={visibleTab === "expenses" ? "default" : "outline"}
              onClick={() => {
                clearFeedback();
                setActiveTab("expenses");
              }}
            >
              帳目與新增支出
            </Button>}
            {activeLedger && <Button
              type="button"
              variant={visibleTab === "settlement" ? "default" : "outline"}
              onClick={() => {
                clearFeedback();
                setActiveTab("settlement");
              }}
            >
              結算
            </Button>}
            {activeLedger && <Button
              type="button"
              variant={visibleTab === "statistics" ? "default" : "outline"}
              onClick={() => {
                clearFeedback();
                setActiveTab("statistics");
              }}
            >
              統計
            </Button>}
            <Button
              type="button"
              variant={visibleTab === "group" ? "default" : "outline"}
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
        {activeLedger && visibleTab === "expenses" && (
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

        {activeLedger && visibleTab === "settlement" && (
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

        {activeLedger && visibleTab === "statistics" && (
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

        {visibleTab === "group" && (
          <LedgerGroupPanel
            ledgers={userLedgers}
            activeLedger={activeLedger}
            firebaseMode={firebaseMode}
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
