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
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChartPie,
  Clock3,
  LayoutDashboard,
  Plus,
  ReceiptText,
  UsersRound,
  Wallet,
} from "lucide-react";
import {
  calculateExpenseStatistics,
  calculateNetBalances,
  formatCurrencyInteger,
  simplifyDebts,
  sumIntegerAmounts,
  validateStatisticsDateRange,
} from "@/lib/finance";
import {
  addExpenseInState,
  type AppDatabaseState,
  confirmRepaymentInState,
  createEmptyAppState,
  createLedgerInState,
  createRepaymentInState,
  deleteAccountInState,
  deleteExpenseInState,
  joinLedgerByInviteInState,
  loadAppState,
  removeMemberFromLedgerInState,
  saveAppState,
  toggleLedgerInviteInState,
  updateExpenseInState,
} from "@/lib/ledgers";
import { isFirebaseEnabled } from "@/lib/firebase/client";
import {
  createFirebaseDocumentId,
  getOrCreateFirebaseUserProfile,
  joinFirebaseLedgerByInvite,
  persistAppStateChanges,
  subscribeToFirebaseWorkspace,
} from "@/lib/firebase/workspace";
import {
  deleteCurrentAuthUser,
  getAuthErrorMessage,
  isTestAuthEnabledForUi,
  signOutCurrentUser,
  subscribeToAuthState,
  switchTestAuthUser,
  type AuthenticatedProfile,
} from "@/lib/firebase/auth";
import type { CurrencyCode } from "@/types/ledger";

type WorkspaceTab =
  | "overview"
  | "expenses"
  | "settlement"
  | "statistics"
  | "group";

const WORKSPACE_NAV = [
  {
    id: "overview",
    label: "帳本總覽",
    description: "收支與待辦摘要",
    icon: LayoutDashboard,
  },
  {
    id: "expenses",
    label: "支出帳目",
    description: "新增、查看與管理",
    icon: ReceiptText,
  },
  {
    id: "settlement",
    label: "結算還款",
    description: "欠款、還款與確認",
    icon: ArrowRight,
  },
  {
    id: "statistics",
    label: "支出統計",
    description: "期間與類別分析",
    icon: ChartPie,
  },
  {
    id: "group",
    label: "群組與成員",
    description: "邀請與成員管理",
    icon: UsersRound,
  },
] as const;

const PAGE_DESCRIPTIONS: Record<WorkspaceTab, string> = {
  overview: "快速掌握帳本支出、成員分帳與需要處理的還款。",
  expenses: "集中管理每筆支出、付款人與成員分攤明細。",
  settlement: "查看每位成員的應收應付，並處理還款確認。",
  statistics: "依日期區間檢視群組支出與個人分攤趨勢。",
  group: "管理帳本、邀請連結、QR Code 與群組成員。",
};

export function SharedLedgerWorkspace() {
  const firebaseMode = isFirebaseEnabled();
  const [appState, setAppState] = React.useState<AppDatabaseState>(() =>
    firebaseMode ? createEmptyAppState() : loadAppState(),
  );
  const [authProfile, setAuthProfile] = React.useState<{
    uid: string;
    email: string;
    phone: string;
    displayName: string;
  } | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [activeLedgerId, setActiveLedgerId] = React.useState<string>(
    "ledger-taipei-trip",
  );
  const [activeTabState, setActiveTabState] =
    React.useState<WorkspaceTab>("overview");
  const [tabSelectedByUser, setTabSelectedByUser] = React.useState(false);
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

  const appStateRef = React.useRef(appState);
  appStateRef.current = appState;
  const cloudUnsubscribeRef = React.useRef<(() => void) | null>(null);
  const authGenerationRef = React.useRef(0);

  const applyAuthProfile = React.useCallback(
    (profile: AuthenticatedProfile | null) => {
      const requestId = ++authGenerationRef.current;
      cloudUnsubscribeRef.current?.();
      cloudUnsubscribeRef.current = null;
      setAuthProfile(profile);
      if (!profile) {
        const signedOutState = firebaseMode
          ? createEmptyAppState()
          : { ...appStateRef.current, currentUserUid: null };
        appStateRef.current = signedOutState;
        setAppState(signedOutState);
        setAuthLoading(false);
        return;
      }

      if (firebaseMode) {
        setAuthLoading(true);
        void getOrCreateFirebaseUserProfile({
          uid: profile.uid,
          email: profile.email,
          phone: profile.phone || undefined,
          displayName: profile.displayName,
        })
          .then((userProfile) => {
            if (requestId !== authGenerationRef.current) {
              return;
            }
            cloudUnsubscribeRef.current = subscribeToFirebaseWorkspace(
              profile.uid,
              userProfile,
              (nextState) => {
                if (requestId !== authGenerationRef.current) {
                  return;
                }
                appStateRef.current = nextState;
                setAppState(nextState);
                setAuthLoading(false);
              },
              (error) => {
                if (requestId !== authGenerationRef.current) {
                  return;
                }
                setFeedbackError(getAuthErrorMessage(error));
                setAuthLoading(false);
              },
            );
            setAuthLoading(false);
          })
          .catch((error: unknown) => {
            if (requestId !== authGenerationRef.current) {
              return;
            }
            setFeedbackError(getAuthErrorMessage(error));
            setAuthLoading(false);
          });
        return;
      }

      setAuthLoading(false);
      const previous = appStateRef.current;
      let nextState: AppDatabaseState = {
        ...previous,
        currentUserUid: profile.uid,
        users: {
          ...previous.users,
          [profile.uid]: {
            uid: profile.uid,
            email: profile.email,
            phone: profile.phone || undefined,
            displayName:
              profile.displayName || profile.email || profile.phone,
            createdAt:
              previous.users[profile.uid]?.createdAt ?? new Date().toISOString(),
          },
        },
      };

      if (!Object.values(nextState.ledgers).some((ledger) =>
        ledger.members.includes(profile.uid),
      )) {
        const result = createLedgerInState(nextState, {
          name: "我的個人帳本",
          currency: "TWD",
        });
        if (result.ledger) {
          nextState = result.nextState;
          setActiveLedgerId(result.ledger.id);
        } else if (result.error) {
          setFeedbackError(result.error);
        }
      }

      appStateRef.current = nextState;
      setAppState(nextState);
    },
    [firebaseMode],
  );

  React.useEffect(() => {
    try {
      const unsubscribeAuth = subscribeToAuthState(applyAuthProfile);
      return () => {
        authGenerationRef.current += 1;
        cloudUnsubscribeRef.current?.();
        cloudUnsubscribeRef.current = null;
        unsubscribeAuth();
      };
    } catch (error) {
      queueMicrotask(() => {
        setFeedbackError(getAuthErrorMessage(error));
        setAuthLoading(false);
      });
      return undefined;
    }
  }, [applyAuthProfile]);

  const currentUser = authProfile
    ? (appState.users[authProfile.uid] ?? {
        uid: authProfile.uid,
        email: authProfile.email,
        phone: authProfile.phone || undefined,
        displayName: authProfile.displayName,
        createdAt: "",
      })
    : null;
  const allUsers = Object.values(appState.users);

  // 使用者參與的帳本列表
  const userLedgers = Object.values(appState.ledgers).filter(
    (l) => currentUser && l.members.includes(currentUser.uid),
  );

  const activeLedger =
    userLedgers.find((ledger) => ledger.id === activeLedgerId) ??
    userLedgers[0] ??
    Object.values(appState.ledgers)[0] ??
    null;

  const currentUserUid = currentUser?.uid ?? "";
  const currentUserRole = activeLedger?.roles[currentUserUid] ?? "Member";
  const selectedLedgerId = activeLedger?.id;

  const inviteFromUrl = React.useSyncExternalStore(
    (callback) => {
      window.addEventListener("popstate", callback);
      return () => window.removeEventListener("popstate", callback);
    },
    () => {
      const url = new URL(window.location.href);
      return firebaseMode
        ? url.searchParams.get("ledger") ?? ""
        : url.searchParams.get("invite") ?? "";
    },
    () => "",
  );
  const activeTab =
    inviteFromUrl && !tabSelectedByUser ? "group" : activeTabState;
  const selectTab = (tab: WorkspaceTab) => {
    setTabSelectedByUser(true);
    setActiveTabState(tab);
  };

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

  const persistNextState = async (
    nextState: AppDatabaseState,
  ): Promise<boolean> => {
    try {
      if (firebaseMode) {
        await persistAppStateChanges(appStateRef.current, nextState);
      } else {
        saveAppState(nextState);
      }
      appStateRef.current = nextState;
      setAppState(nextState);
      return true;
    } catch (error) {
      setFeedbackError(getAuthErrorMessage(error));
      return false;
    }
  };

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

  const handleSwitchTestUser = (uid: string) => {
    clearFeedback();
    try {
      switchTestAuthUser(uid);
    } catch (error) {
      setFeedbackError(getAuthErrorMessage(error));
    }
  };

  const handleLogout = async () => {
    clearFeedback();
    try {
      await signOutCurrentUser();
    } catch (error) {
      setFeedbackError(getAuthErrorMessage(error));
    }
  };

  const handleDeleteAccount = async (): Promise<boolean> => {
    clearFeedback();
    if (firebaseMode) {
      setFeedbackError(
        "Firebase 帳號刪除需先完成安全的群組資料處理，目前尚未開放",
      );
      return false;
    }
    const res = deleteAccountInState(appState);
    if (res.error) {
      setFeedbackError(res.error);
      return false;
    }
    try {
      await deleteCurrentAuthUser();
      saveAppState(res.nextState);
      setAppState(res.nextState);
      setFeedbackSuccess(`已成功刪除帳號「${res.deletedUserName}」並退出相關群組`);
      return true;
    } catch (error) {
      setFeedbackError(getAuthErrorMessage(error));
      return false;
    }
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
      if (!authProfile) {
        setFeedbackError("請先登入再加入群組");
        return;
      }
      try {
        const inviteUrl = new URL(inviteCodeOrUrl.trim(), window.location.origin);
        const ledgerId = inviteUrl.searchParams.get("ledger");
        if (!ledgerId) {
          setFeedbackError("請貼上完整的群組邀請連結");
          return;
        }
        await joinFirebaseLedgerByInvite({
          ledgerId,
          uid: authProfile.uid,
          displayName: currentUser?.displayName ?? authProfile.displayName,
          email: authProfile.email,
        });
        setActiveLedgerId(ledgerId);
        setFeedbackSuccess("已成功加入群組！");
      } catch (error) {
        const code =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "permission-denied";
        setFeedbackError(
          code
            ? "此邀請連結已失效，請向群組管理者索取新連結"
            : getAuthErrorMessage(error),
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
  const activePage =
    WORKSPACE_NAV.find((item) => item.id === activeTab) ?? WORKSPACE_NAV[0];
  const totalLedgerExpense = sumIntegerAmounts(
    activeTransactions.map((transaction) => transaction.amount),
  );
  const recentTransactions = [...activeTransactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const pendingRepaymentCount = activeRepayments.filter(
    (repayment) => repayment.status === "pending",
  ).length;

  const handleSelectLedger = (ledgerId: string) => {
    clearFeedback();
    setActiveLedgerId(ledgerId);
  };

  const handleChangeDateRange = (startDate: string, endDate: string) => {
    clearFeedback();
    const validation = validateStatisticsDateRange(
      startDate || undefined,
      endDate || undefined,
    );
    if (!validation.valid) {
      setFeedbackError(validation.error ?? "請選擇有效的統計日期");
      return;
    }
    setStatsStartDate(startDate);
    setStatsEndDate(endDate);
  };

  const appHeader = (
    <AppHeader
      currentUser={currentUser}
      allUsers={allUsers}
      testAuthEnabled={isTestAuthEnabledForUi()}
      authError={feedbackError}
      authSuccess={feedbackSuccess}
      onDeleteAccount={handleDeleteAccount}
      onAuthProfileChanged={applyAuthProfile}
      onSwitchTestUser={handleSwitchTestUser}
      onLogout={handleLogout}
    />
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        {appHeader}
        <main className="mx-auto max-w-6xl px-6 py-8 text-sm text-slate-600">
          正在確認登入狀態…
        </main>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        {appHeader}
        <main className="mx-auto max-w-6xl px-6 py-8 text-sm text-slate-600">
          請先登入或建立帳號，再使用共用帳本功能。
        </main>
      </div>
    );
  }

  if (!activeLedger) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        {appHeader}
        <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">尚未加入帳本</h1>
            <p className="mt-1 text-sm text-slate-600">
              建立新群組，或使用邀請連結加入現有群組。
            </p>
          </div>
          <LedgerGroupPanel
            ledgers={userLedgers}
            activeLedger={null}
            firebaseMode={firebaseMode}
            currentUserUid={currentUserUid}
            currentUserRole={currentUserRole}
            netBalances={netBalances}
            feedbackError={feedbackError}
            feedbackSuccess={feedbackSuccess}
            onSelectLedger={handleSelectLedger}
            onCreateLedger={handleCreateLedger}
            onJoinLedger={handleJoinLedger}
            onToggleInviteActive={handleToggleInvite}
            onRemoveMember={handleRemoveMember}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7f6] text-slate-900">
      {appHeader}

      <main className="mx-auto grid max-w-screen-2xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-7 lg:px-8 lg:py-8">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label
              htmlFor="workspace-ledger-select"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              目前帳本
            </label>
            <select
              id="workspace-ledger-select"
              aria-label="切換帳本"
              value={activeLedger.id}
              onChange={(event) => handleSelectLedger(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            >
              {userLedgers.map((ledger) => (
                <option key={ledger.id} value={ledger.id}>
                  {ledger.name}
                </option>
              ))}
            </select>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <span className="text-slate-500">帳本幣別</span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
                {activeLedger.currency}
              </span>
            </div>
          </section>

          <nav
            aria-label="主要功能導覽"
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <h2 className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              工作區
            </h2>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
              {WORKSPACE_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => {
                      clearFeedback();
                      selectTab(item.id);
                    }}
                    className={`group flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isActive
                        ? "bg-emerald-700 text-white shadow-sm"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isActive
                          ? "bg-white/15 text-white"
                          : "bg-slate-100 text-slate-600 group-hover:bg-white"
                      }`}
                    >
                      <Icon aria-hidden="true" size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {item.label}
                      </span>
                      <span
                        className={`mt-0.5 hidden truncate text-[11px] sm:block ${
                          isActive ? "text-emerald-100" : "text-slate-500"
                        }`}
                      >
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">你的帳本權限</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <UsersRound aria-hidden="true" size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {currentUserRole === "Owner"
                    ? "群組管理者"
                    : currentUserRole === "Editor"
                      ? "編輯成員"
                      : currentUserRole === "Viewer"
                        ? "檢視成員"
                        : "一般成員"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {activeLedger.members.length} 位帳本成員
                </p>
              </div>
            </div>
          </section>
        </aside>

        <section className="min-w-0">
          <header className="mb-5 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:px-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-700">
                {activePage.label}
              </p>
              <h1
                data-testid="active-ledger-title"
                className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
              >
                {activeLedger.name}
              </h1>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {PAGE_DESCRIPTIONS[activeTab]}
              </p>
            </div>
            {activeTab !== "expenses" && (
              <Button
                type="button"
                onClick={() => selectTab("expenses")}
                className="shrink-0"
              >
                <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                新增支出
              </Button>
            )}
          </header>

          {ledgerNotifications.length > 0 && (
            <div
              aria-label="系統最新通知"
              className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900"
            >
              <span className="font-semibold">最新群組通知：</span>{" "}
              {ledgerNotifications[0]?.message}
            </div>
          )}

          {(feedbackError || feedbackSuccess) && activeTab === "overview" && (
            <div
              role={feedbackError ? "alert" : "status"}
              className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
                feedbackError
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {feedbackError ?? feedbackSuccess}
            </div>
          )}

          {activeTab === "overview" && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      帳本總支出
                    </p>
                    <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                      <Wallet aria-hidden="true" size={18} />
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                    {formatCurrencyInteger(totalLedgerExpense, activeLedger.currency)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    共 {activeTransactions.length} 筆支出
                  </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      我的帳本餘額
                    </p>
                    <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
                      {(netBalances[currentUserUid] ?? 0) < 0 ? (
                        <ArrowDownLeft aria-hidden="true" size={18} />
                      ) : (
                        <ArrowUpRight aria-hidden="true" size={18} />
                      )}
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                    {formatCurrencyInteger(
                      Math.abs(netBalances[currentUserUid] ?? 0),
                      activeLedger.currency,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(netBalances[currentUserUid] ?? 0) > 0
                      ? "目前應收"
                      : (netBalances[currentUserUid] ?? 0) < 0
                        ? "目前應付"
                        : "帳款已結清"}
                  </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      待確認還款
                    </p>
                    <span className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
                      <Clock3 aria-hidden="true" size={18} />
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                    {pendingRepaymentCount} 筆
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    群組中等待收款人確認
                  </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-500">
                      群組成員
                    </p>
                    <span className="rounded-xl bg-violet-50 p-2.5 text-violet-700">
                      <UsersRound aria-hidden="true" size={18} />
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                    {activeLedger.members.length} 位
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    一起管理這本帳
                  </p>
                </article>
              </div>

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-950">
                        最近支出
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        依日期顯示最近的帳目
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectTab("expenses")}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      查看全部 <ArrowRight aria-hidden="true" size={15} />
                    </button>
                  </div>

                  {recentTransactions.length > 0 ? (
                    <ul className="divide-y divide-slate-100">
                      {recentTransactions.map((transaction) => (
                        <li
                          key={transaction.id}
                          className="flex items-center justify-between gap-4 py-3.5"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                              <ReceiptText aria-hidden="true" size={17} />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {transaction.title}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {transaction.date} ・
                                {activeLedger.memberProfiles[
                                  transaction.payerId
                                ]?.displayName ?? transaction.payerId}
                                {" ・"}
                                {transaction.category}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-slate-900">
                            {formatCurrencyInteger(
                              transaction.amount,
                              activeLedger.currency,
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-xl bg-slate-50 px-4 py-8 text-center">
                      <p className="text-sm font-semibold text-slate-800">
                        還沒有支出紀錄
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        建立第一筆支出，開始和大家一起記帳。
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => selectTab("expenses")}
                        className="mt-4"
                      >
                        <Plus aria-hidden="true" className="mr-1.5 h-4 w-4" />
                        新增第一筆支出
                      </Button>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-base font-bold text-slate-950">
                    常用功能
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    選擇下一步要處理的帳本事項
                  </p>
                  <div className="mt-4 space-y-2">
                    {WORKSPACE_NAV.filter((item) =>
                      ["expenses", "settlement", "group"].includes(item.id),
                    ).map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectTab(item.id)}
                          className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/50"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                            <Icon aria-hidden="true" size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-800">
                              {item.label}
                            </span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {item.description}
                            </span>
                          </span>
                          <ArrowRight
                            aria-hidden="true"
                            className="shrink-0 text-slate-400"
                            size={16}
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          )}

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
              onChangeDateRange={handleChangeDateRange}
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
              onChangeDateRange={handleChangeDateRange}
              onCreateRepayment={handleCreateRepayment}
              onConfirmRepayment={handleConfirmRepayment}
            />
          )}

          {activeTab === "group" && (
            <LedgerGroupPanel
              ledgers={userLedgers}
              activeLedger={activeLedger}
              firebaseMode={firebaseMode}
              currentUserUid={currentUserUid}
              currentUserRole={currentUserRole}
              netBalances={netBalances}
              feedbackError={feedbackError}
              feedbackSuccess={feedbackSuccess}
              onSelectLedger={handleSelectLedger}
              onCreateLedger={handleCreateLedger}
              onJoinLedger={handleJoinLedger}
              onToggleInviteActive={handleToggleInvite}
              onRemoveMember={handleRemoveMember}
            />
          )}
        </section>
      </main>
    </div>
  );
}
