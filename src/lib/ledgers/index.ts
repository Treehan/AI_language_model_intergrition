/**
 * 帳本權限、交易與結算資料操作 Service 層 (lib/ledgers/)
 * 同時提供 Firestore Client SDK (withConverter<T>) 存取函式與本機互動狀態管理，
 * 確保所有集合操作強型別化且 UI 元件純粹透過 props 接收資料（遵循 ARCHITECTURE.md 第三與第四節）。
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  calculateEqualSplit,
  calculateNetBalances,
  canRemoveMember,
  validateCustomSplit,
  validateExpenseInput,
  validateRepaymentAmount,
} from "@/lib/finance";
import {
  getFirebaseClientDb,
  isFirebaseEnabled,
} from "@/lib/firebase/client";
import {
  ledgerConverter,
  notificationConverter,
  repaymentConverter,
  transactionConverter,
  userProfileConverter,
} from "@/lib/firebase/converters";
import type {
  CurrencyCode,
  Ledger,
  LedgerNotification,
  LedgerRole,
  UserProfile,
} from "@/types/ledger";
import type {
  ExpenseCategory,
  Repayment,
  SplitMethod,
  Transaction,
} from "@/types/transaction";

/**
 * Firestore 集合參考（強制套用 withConverter<T>()）
 */
export function getUsersCollection() {
  return collection(getFirebaseClientDb(), "users").withConverter(
    userProfileConverter,
  );
}

export function getLedgersCollection() {
  return collection(getFirebaseClientDb(), "ledgers").withConverter(
    ledgerConverter,
  );
}

export function getTransactionsCollection(ledgerId: string) {
  return collection(
    getFirebaseClientDb(),
    "ledgers",
    ledgerId,
    "transactions",
  ).withConverter(transactionConverter);
}

export function getRepaymentsCollection(ledgerId: string) {
  return collection(
    getFirebaseClientDb(),
    "ledgers",
    ledgerId,
    "repayments",
  ).withConverter(repaymentConverter);
}

export function getNotificationsCollection(ledgerId: string) {
  return collection(
    getFirebaseClientDb(),
    "ledgers",
    ledgerId,
    "notifications",
  ).withConverter(notificationConverter);
}

/**
 * 透過 Firestore 查詢使用者參與的所有帳本
 */
export async function fetchUserLedgersFromFirestore(
  uid: string,
): Promise<Ledger[]> {
  const q = query(
    getLedgersCollection(),
    where("members", "array-contains", uid),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

/**
 * 透過 Firestore 建立或更新帳本
 */
export async function saveLedgerToFirestore(ledger: Ledger): Promise<void> {
  const ref = doc(getLedgersCollection(), ledger.id);
  await setDoc(ref, ledger);
}

/**
 * 透過 Firestore 讀取單一帳本
 */
export async function fetchLedgerByIdFromFirestore(
  ledgerId: string,
): Promise<Ledger | null> {
  const ref = doc(getLedgersCollection(), ledgerId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * 透過 Firestore 新增或更新支出交易
 */
export async function saveTransactionToFirestore(
  tx: Transaction,
): Promise<void> {
  const ref = doc(getTransactionsCollection(tx.ledgerId), tx.id);
  await setDoc(ref, tx);
}

/**
 * 透過 Firestore 刪除支出交易
 */
export async function deleteTransactionFromFirestore(
  ledgerId: string,
  txId: string,
): Promise<void> {
  const ref = doc(getTransactionsCollection(ledgerId), txId);
  await deleteDoc(ref);
}

/**
 * 透過 Firestore 儲存還款紀錄
 */
export async function saveRepaymentToFirestore(rep: Repayment): Promise<void> {
  const ref = doc(getRepaymentsCollection(rep.ledgerId), rep.id);
  await setDoc(ref, rep);
}

/**
 * 透過 Firestore 更新還款狀態
 */
export async function confirmRepaymentInFirestore(
  ledgerId: string,
  repaymentId: string,
  confirmedAt: string,
): Promise<void> {
  const ref = doc(getRepaymentsCollection(ledgerId), repaymentId);
  await updateDoc(ref, { status: "confirmed", confirmedAt });
}

// ============================================================================
// 應用程式領域服務與狀態儲存層（支援瀏覽器本機持久化與雲端同步）
// ============================================================================

export interface AppDatabaseState {
  users: Record<string, UserProfile & { password?: string }>;
  currentUserUid: string | null;
  ledgers: Record<string, Ledger>;
  transactions: Record<string, Transaction[]>;
  repayments: Record<string, Repayment[]>;
  notifications: LedgerNotification[];
}

export function createEmptyAppState(): AppDatabaseState {
  return {
    users: {},
    currentUserUid: null,
    ledgers: {},
    transactions: {},
    repayments: {},
    notifications: [],
  };
}

const STORAGE_KEY = "tw_split_ledger_app_state_v1";

/**
 * 建立預設展示與種子資料，讓使用者與自動化測試可立即體驗完整流程
 */
export function createInitialAppState(): AppDatabaseState {
  const now = "2026-11-16T09:00:00.000Z";
  const u1: UserProfile & { password?: string } = {
    uid: "user-owner-1",
    email: "alice@example.com",
    phone: "0912345678",
    displayName: "陳小美",
    password: "password123",
    createdAt: now,
  };
  const u2: UserProfile & { password?: string } = {
    uid: "user-member-2",
    email: "bob@example.com",
    phone: "0922333444",
    displayName: "林大明",
    password: "password123",
    createdAt: now,
  };
  const u3: UserProfile & { password?: string } = {
    uid: "user-member-3",
    email: "carol@example.com",
    phone: "0933555666",
    displayName: "張雅婷",
    password: "password123",
    createdAt: now,
  };
  const u4: UserProfile & { password?: string } = {
    uid: "user-settled-4",
    email: "david@example.com",
    phone: "0944777888",
    displayName: "王志豪",
    password: "password123",
    createdAt: now,
  };

  const defaultLedgerId = "ledger-taipei-trip";
  const expiredLedgerId = "ledger-expired-invite";

  const defaultLedger: Ledger = {
    id: defaultLedgerId,
    name: "花蓮三天兩夜旅遊帳本",
    currency: "TWD",
    members: [u1.uid, u2.uid, u3.uid, u4.uid],
    roles: {
      [u1.uid]: "Owner",
      [u2.uid]: "Editor",
      [u3.uid]: "Member",
      [u4.uid]: "Member",
    },
    memberProfiles: {
      [u1.uid]: {
        uid: u1.uid,
        displayName: u1.displayName,
        email: u1.email,
        joinedAt: now,
      },
      [u2.uid]: {
        uid: u2.uid,
        displayName: u2.displayName,
        email: u2.email,
        joinedAt: now,
      },
      [u3.uid]: {
        uid: u3.uid,
        displayName: u3.displayName,
        email: u3.email,
        joinedAt: now,
      },
      [u4.uid]: {
        uid: u4.uid,
        displayName: u4.displayName,
        email: u4.email,
        joinedAt: now,
      },
    },
    invite: {
      code: "HUALIEN2026",
      active: true,
      expiresAt: "2027-12-31T23:59:59.000Z",
      createdBy: u1.uid,
    },
    createdAt: now,
    updatedAt: now,
  };

  const expiredLedger: Ledger = {
    id: expiredLedgerId,
    name: "已封存舊聚餐帳本",
    currency: "TWD",
    members: [u2.uid],
    roles: {
      [u2.uid]: "Owner",
    },
    memberProfiles: {
      [u2.uid]: {
        uid: u2.uid,
        displayName: u2.displayName,
        email: u2.email,
        joinedAt: now,
      },
    },
    invite: {
      code: "EXPIRED2025",
      active: false,
      expiresAt: "2025-01-01T00:00:00.000Z",
      createdBy: u2.uid,
    },
    createdAt: now,
    updatedAt: now,
  };

  const initialTransactions: Transaction[] = [
    {
      id: "tx-1",
      ledgerId: defaultLedgerId,
      title: "東大門夜市聚餐",
      amount: 900,
      payerId: u1.uid,
      createdBy: u1.uid,
      date: "2026-11-15",
      category: "餐飲",
      splitMethod: "equal",
      participants: [u1.uid, u2.uid, u3.uid],
      splits: {
        [u1.uid]: 300,
        [u2.uid]: 300,
        [u3.uid]: 300,
      },
      createdAt: now,
      updatedAt: now,
      history: [],
    },
    {
      id: "tx-2",
      ledgerId: defaultLedgerId,
      title: "火車票與租車費用",
      amount: 600,
      payerId: u2.uid,
      createdBy: u2.uid,
      date: "2026-11-16",
      category: "交通",
      splitMethod: "equal",
      participants: [u1.uid, u2.uid, u3.uid],
      splits: {
        [u1.uid]: 200,
        [u2.uid]: 200,
        [u3.uid]: 200,
      },
      createdAt: now,
      updatedAt: now,
      history: [],
    },
  ];

  return {
    users: {
      [u1.uid]: u1,
      [u2.uid]: u2,
      [u3.uid]: u3,
      [u4.uid]: u4,
    },
    currentUserUid: u1.uid,
    ledgers: {
      [defaultLedgerId]: defaultLedger,
      [expiredLedgerId]: expiredLedger,
    },
    transactions: {
      [defaultLedgerId]: initialTransactions,
      [expiredLedgerId]: [],
    },
    repayments: {
      [defaultLedgerId]: [],
      [expiredLedgerId]: [],
    },
    notifications: [],
  };
}

export function loadAppState(): AppDatabaseState {
  if (typeof window === "undefined") {
    return createInitialAppState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialAppState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as AppDatabaseState;
  } catch {
    return createInitialAppState();
  }
}

export function saveAppState(state: AppDatabaseState): void {
  if (typeof window === "undefined" || isFirebaseEnabled()) {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 忽略無痕模式或配額錯誤
  }
}

/**
 * User Story 1：建立帳號
 * - 檢查電子郵件或手機號碼是否已被使用
 * - 若已存在則回傳「此帳號已存在，請直接登入」
 * - 成功建立後直接進入已登入狀態
 */
export function registerAccountInState(
  state: AppDatabaseState,
  params: {
    identifier: string;
    password: string;
    displayName: string;
  },
): { nextState: AppDatabaseState; error?: string; user?: UserProfile } {
  const identifier = params.identifier.trim();
  const displayName = params.displayName.trim();
  const password = params.password.trim();

  if (!identifier) {
    return { nextState: state, error: "請輸入電子郵件或手機號碼" };
  }
  if (!password || password.length < 6) {
    return { nextState: state, error: "請輸入至少 6 碼的密碼" };
  }
  if (!displayName) {
    return { nextState: state, error: "請輸入暱稱" };
  }

  const normalizedId = identifier.toLowerCase();
  const exists = Object.values(state.users).some(
    (u) =>
      u.email.toLowerCase() === normalizedId ||
      (u.phone && u.phone === normalizedId),
  );

  if (exists) {
    return {
      nextState: state,
      error: "此帳號已存在，請直接登入",
    };
  }

  const isPhone = /^[0-9+\-\s]+$/.test(identifier);
  const uid = `user-${Date.now()}`;
  const now = new Date().toISOString();
  const newUser: UserProfile & { password?: string } = {
    uid,
    email: isPhone ? `${identifier}@phone.local` : identifier,
    phone: isPhone ? identifier : undefined,
    displayName,
    password,
    createdAt: now,
  };

  const nextState: AppDatabaseState = {
    ...state,
    users: {
      ...state.users,
      [uid]: newUser,
    },
    currentUserUid: uid,
  };
  saveAppState(nextState);
  return { nextState, user: newUser };
}

/**
 * 登入既有帳號
 */
export function loginAccountInState(
  state: AppDatabaseState,
  params: { identifier: string; password: string },
): { nextState: AppDatabaseState; error?: string; user?: UserProfile } {
  const normalizedId = params.identifier.trim().toLowerCase();
  const found = Object.values(state.users).find(
    (u) =>
      u.email.toLowerCase() === normalizedId ||
      (u.phone && u.phone === normalizedId),
  );
  if (!found) {
    return { nextState: state, error: "找不到此帳號，請先建立帳號" };
  }
  if (found.password && found.password !== params.password) {
    return { nextState: state, error: "密碼不正確，請重新輸入" };
  }
  const nextState: AppDatabaseState = {
    ...state,
    currentUserUid: found.uid,
  };
  saveAppState(nextState);
  return { nextState, user: found };
}

/**
 * 刪除個人帳號
 * - 檢查該使用者在所有參與的群組帳本中是否有未結清款項（應收、應付或待確認還款）
 * - 若尚有未結清款項，拒絕刪除並提示「您尚有未結清的群組款項，請先完成結算後再刪除帳號」
 * - 若皆已結清，將使用者從所有帳本移除（若為唯一成員則一併移除該空帳本；若仍有其他成員且原為 Owner，自動將 Owner 權限移交給下一位成員），並刪除帳號資料與登出
 */
export function deleteAccountInState(
  state: AppDatabaseState,
  targetUid?: string,
): { nextState: AppDatabaseState; error?: string; deletedUserName?: string } {
  const uid = targetUid ?? state.currentUserUid;
  if (!uid || !state.users[uid]) {
    return { nextState: state, error: "請先登入再執行刪除帳號" };
  }

  const userToDelete = state.users[uid];

  // 檢查所有包含該成員的帳本是否皆已結清
  for (const ledger of Object.values(state.ledgers)) {
    if (!ledger.members.includes(uid)) {
      continue;
    }
    const txList = state.transactions[ledger.id] ?? [];
    const repList = state.repayments[ledger.id] ?? [];
    const netBalances = calculateNetBalances(ledger.members, txList, repList);
    const check = canRemoveMember({
      targetUid: uid,
      netBalances,
      pendingRepayments: repList,
    });
    if (!check.allowed) {
      return {
        nextState: state,
        error: `您在「${ledger.name}」尚有未結清款項，請先完成結算後再刪除帳號`,
      };
    }
  }

  const nextUsers = { ...state.users };
  delete nextUsers[uid];

  const nextLedgers: Record<string, Ledger> = {};
  const nextTransactions = { ...state.transactions };
  const nextRepayments = { ...state.repayments };
  const now = new Date().toISOString();

  for (const [ledgerId, ledger] of Object.entries(state.ledgers)) {
    if (!ledger.members.includes(uid)) {
      nextLedgers[ledgerId] = ledger;
      continue;
    }

    const remainingMembers = ledger.members.filter((m) => m !== uid);
    if (remainingMembers.length === 0) {
      // 若該帳本已無任何其他成員，一併清理空帳本
      delete nextTransactions[ledgerId];
      delete nextRepayments[ledgerId];
      continue;
    }

    const nextRoles = { ...ledger.roles };
    const wasOwner = nextRoles[uid] === "Owner";
    delete nextRoles[uid];

    // 若原本是群組管理者且群組內無其他 Owner，將第一位剩餘成員升為 Owner
    const hasAnotherOwner = remainingMembers.some(
      (m) => nextRoles[m] === "Owner",
    );
    if (wasOwner && !hasAnotherOwner && remainingMembers[0]) {
      nextRoles[remainingMembers[0]] = "Owner";
    }

    const nextProfiles = { ...ledger.memberProfiles };
    delete nextProfiles[uid];

    nextLedgers[ledgerId] = {
      ...ledger,
      members: remainingMembers,
      roles: nextRoles,
      memberProfiles: nextProfiles,
      updatedAt: now,
    };
  }

  const remainingUserUids = Object.keys(nextUsers);
  const nextCurrentUid =
    state.currentUserUid === uid
      ? (remainingUserUids[0] ?? null)
      : state.currentUserUid;

  const notif: LedgerNotification = {
    id: `notif-del-acc-${Date.now()}`,
    ledgerId: Object.keys(nextLedgers)[0] ?? "system",
    recipientUid: "all",
    message: `會員「${userToDelete.displayName}」已刪除個人帳號並退出相關群組`,
    createdAt: now,
    read: false,
  };

  const nextState: AppDatabaseState = {
    ...state,
    users: nextUsers,
    currentUserUid: nextCurrentUid,
    ledgers: nextLedgers,
    transactions: nextTransactions,
    repayments: nextRepayments,
    notifications: [notif, ...state.notifications],
  };

  saveAppState(nextState);
  return { nextState, deletedUserName: userToDelete.displayName };
}

/**
 * User Story 2：建立記帳群組並產生邀請連結與 QR Code
 * 建立者自動成為群組管理者 (Owner)
 */
export function createLedgerInState(
  state: AppDatabaseState,
  params: {
    name: string;
    currency: CurrencyCode;
    id?: string;
    inviteCode?: string;
  },
): { nextState: AppDatabaseState; error?: string; ledger?: Ledger } {
  const currentUid = state.currentUserUid;
  if (!currentUid || !state.users[currentUid]) {
    return { nextState: state, error: "請先登入再建立群組" };
  }
  const trimmedName = params.name.trim();
  if (!trimmedName) {
    return { nextState: state, error: "請輸入群組名稱" };
  }

  const creator = state.users[currentUid];
  const now = new Date().toISOString();
  const ledgerId = params.id ?? `ledger-${Date.now()}`;
  const inviteCode =
    params.inviteCode ??
    `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const newLedger: Ledger = {
    id: ledgerId,
    name: trimmedName,
    currency: params.currency,
    members: [currentUid],
    roles: {
      [currentUid]: "Owner",
    },
    memberProfiles: {
      [currentUid]: {
        uid: currentUid,
        displayName: creator.displayName,
        email: creator.email,
        joinedAt: now,
      },
    },
    invite: {
      code: inviteCode,
      active: true,
      expiresAt: "2028-12-31T23:59:59.000Z",
      createdBy: currentUid,
    },
    createdAt: now,
    updatedAt: now,
  };

  const nextState: AppDatabaseState = {
    ...state,
    ledgers: {
      ...state.ledgers,
      [ledgerId]: newLedger,
    },
    transactions: {
      ...state.transactions,
      [ledgerId]: [],
    },
    repayments: {
      ...state.repayments,
      [ledgerId]: [],
    },
  };
  saveAppState(nextState);
  return { nextState, ledger: newLedger };
}

/**
 * User Story 3：透過邀請連結或邀請碼加入群組
 * - 若連結已過期或被管理者關閉，顯示「此邀請連結已失效，請向群組管理者索取新連結」
 */
export function joinLedgerByInviteInState(
  state: AppDatabaseState,
  inviteCodeOrUrl: string,
): { nextState: AppDatabaseState; error?: string; ledger?: Ledger } {
  const currentUid = state.currentUserUid;
  if (!currentUid || !state.users[currentUid]) {
    return { nextState: state, error: "請先登入再加入群組" };
  }

  const raw = inviteCodeOrUrl.trim();
  if (!raw) {
    return { nextState: state, error: "請輸入邀請碼或邀請連結" };
  }

  // 支援完整連結 (例如 ?invite=CODE) 或純邀請碼
  let extractedCode = raw;
  try {
    if (raw.includes("invite=")) {
      const url = new URL(raw, "http://localhost");
      extractedCode = url.searchParams.get("invite") ?? raw;
    }
  } catch {
    extractedCode = raw;
  }

  const targetLedger = Object.values(state.ledgers).find(
    (l) => l.invite.code.toUpperCase() === extractedCode.toUpperCase(),
  );

  if (!targetLedger) {
    return {
      nextState: state,
      error: "此邀請連結已失效，請向群組管理者索取新連結",
    };
  }

  const isExpired =
    !targetLedger.invite.active ||
    new Date(targetLedger.invite.expiresAt).getTime() < Date.now();

  if (isExpired) {
    return {
      nextState: state,
      error: "此邀請連結已失效，請向群組管理者索取新連結",
    };
  }

  const user = state.users[currentUid];
  if (targetLedger.members.includes(currentUid)) {
    return { nextState: state, ledger: targetLedger };
  }

  const now = new Date().toISOString();
  const updatedLedger: Ledger = {
    ...targetLedger,
    members: [...targetLedger.members, currentUid],
    roles: {
      ...targetLedger.roles,
      [currentUid]: "Editor",
    },
    memberProfiles: {
      ...targetLedger.memberProfiles,
      [currentUid]: {
        uid: currentUid,
        displayName: user.displayName,
        email: user.email,
        joinedAt: now,
      },
    },
    updatedAt: now,
  };

  const nextState: AppDatabaseState = {
    ...state,
    ledgers: {
      ...state.ledgers,
      [targetLedger.id]: updatedLedger,
    },
  };
  saveAppState(nextState);
  return { nextState, ledger: updatedLedger };
}

/**
 * 切換邀請連結啟用/停用狀態（僅群組管理者 Owner 可操作）
 */
export function toggleLedgerInviteInState(
  state: AppDatabaseState,
  ledgerId: string,
  active: boolean,
): { nextState: AppDatabaseState; error?: string } {
  const ledger = state.ledgers[ledgerId];
  const currentUid = state.currentUserUid;
  if (!ledger || !currentUid) {
    return { nextState: state, error: "找不到帳本" };
  }
  if (ledger.roles[currentUid] !== "Owner") {
    return { nextState: state, error: "僅群組管理者可變更邀請連結設定" };
  }

  const updatedLedger: Ledger = {
    ...ledger,
    invite: {
      ...ledger.invite,
      active,
    },
    updatedAt: new Date().toISOString(),
  };

  const nextState: AppDatabaseState = {
    ...state,
    ledgers: {
      ...state.ledgers,
      [ledgerId]: updatedLedger,
    },
  };
  saveAppState(nextState);
  return { nextState };
}

/**
 * User Story 4 & 5：新增支出並計算分攤（平均分攤或指定金額）
 * 並發送通知給相關分攤成員
 */
export function addExpenseInState(
  state: AppDatabaseState,
  params: {
    ledgerId: string;
    title: string;
    amount: number;
    payerId: string;
    date: string;
    category: ExpenseCategory;
    splitMethod: SplitMethod;
    participants: string[];
    customSplits?: Record<string, number>;
  },
): { nextState: AppDatabaseState; error?: string; transaction?: Transaction } {
  const currentUid = state.currentUserUid;
  const ledger = state.ledgers[params.ledgerId];
  if (!currentUid || !ledger) {
    return { nextState: state, error: "找不到群組帳本或尚未登入" };
  }
  if (!ledger.members.includes(currentUid)) {
    return { nextState: state, error: "您不是此群組的成員，無權新增支出" };
  }
  const role: LedgerRole = ledger.roles[currentUid] ?? "Viewer";
  if (role === "Viewer") {
    return { nextState: state, error: "檢視者無權新增支出" };
  }
  // Pillar 2: 一般成員 (Member) 不可偽造他人為付款人，僅 Owner / Editor 可代指定其他成員為付款人
  if (role === "Member" && params.payerId !== currentUid) {
    return {
      nextState: state,
      error: "一般成員僅能建立自己付款的支出，若需代記他人付款請由管理者或編輯者操作",
    };
  }

  const basicValidation = validateExpenseInput({
    title: params.title,
    amount: params.amount,
    participants: params.participants,
  });
  if (!basicValidation.valid) {
    return { nextState: state, error: basicValidation.error };
  }

  let finalSplits: Record<string, number> = {};
  if (params.splitMethod === "equal") {
    finalSplits = calculateEqualSplit(params.amount, params.participants);
  } else {
    const customCheck = validateCustomSplit(
      params.amount,
      params.customSplits ?? {},
      params.participants,
    );
    if (!customCheck.valid || !customCheck.normalizedSplits) {
      return { nextState: state, error: customCheck.error };
    }
    finalSplits = customCheck.normalizedSplits;
  }

  const now = new Date().toISOString();
  const tx: Transaction = {
    id: `tx-${Date.now()}`,
    ledgerId: params.ledgerId,
    title: params.title.trim(),
    amount: params.amount,
    payerId: params.payerId,
    createdBy: currentUid,
    date: params.date || now.slice(0, 10),
    category: params.category,
    splitMethod: params.splitMethod,
    participants: Array.from(new Set(params.participants)),
    splits: finalSplits,
    createdAt: now,
    updatedAt: now,
    history: [],
  };

  const newNotifications: LedgerNotification[] = tx.participants.map((uid) => ({
    id: `notif-${Date.now()}-${uid}`,
    ledgerId: params.ledgerId,
    recipientUid: uid,
    message: `新增支出「${tx.title}」（${tx.amount} 元），您的分攤金額為 ${tx.splits[uid] ?? 0} 元`,
    createdAt: now,
    read: false,
  }));

  const currentList = state.transactions[params.ledgerId] ?? [];
  const nextState: AppDatabaseState = {
    ...state,
    transactions: {
      ...state.transactions,
      [params.ledgerId]: [tx, ...currentList],
    },
    notifications: [...newNotifications, ...state.notifications],
  };
  saveAppState(nextState);
  return { nextState, transaction: tx };
}

/**
 * User Story 8：管理群組支出（修改或刪除群組內任何一筆支出，保留修改紀錄並通知相關成員）
 */
export function updateExpenseInState(
  state: AppDatabaseState,
  params: {
    ledgerId: string;
    transactionId: string;
    title: string;
    amount: number;
    payerId: string;
    date: string;
    category: ExpenseCategory;
    splitMethod: SplitMethod;
    participants: string[];
    customSplits?: Record<string, number>;
  },
): { nextState: AppDatabaseState; error?: string; transaction?: Transaction } {
  const currentUid = state.currentUserUid;
  const ledger = state.ledgers[params.ledgerId];
  if (!currentUid || !ledger) {
    return { nextState: state, error: "找不到帳本或尚未登入" };
  }
  const role = ledger.roles[currentUid];
  if (role !== "Owner" && role !== "Editor") {
    return { nextState: state, error: "僅群組管理者或編輯者可修改支出" };
  }

  const txList = state.transactions[params.ledgerId] ?? [];
  const existing = txList.find((t) => t.id === params.transactionId);
  if (!existing) {
    return { nextState: state, error: "找不到該筆支出紀錄" };
  }

  const basicValidation = validateExpenseInput({
    title: params.title,
    amount: params.amount,
    participants: params.participants,
  });
  if (!basicValidation.valid) {
    return { nextState: state, error: basicValidation.error };
  }

  let finalSplits: Record<string, number> = {};
  if (params.splitMethod === "equal") {
    finalSplits = calculateEqualSplit(params.amount, params.participants);
  } else {
    const customCheck = validateCustomSplit(
      params.amount,
      params.customSplits ?? {},
      params.participants,
    );
    if (!customCheck.valid || !customCheck.normalizedSplits) {
      return { nextState: state, error: customCheck.error };
    }
    finalSplits = customCheck.normalizedSplits;
  }

  const now = new Date().toISOString();
  const updatedTx: Transaction = {
    ...existing,
    title: params.title.trim(),
    amount: params.amount,
    payerId: params.payerId,
    date: params.date,
    category: params.category,
    splitMethod: params.splitMethod,
    participants: Array.from(new Set(params.participants)),
    splits: finalSplits,
    updatedAt: now,
    history: [
      ...existing.history,
      {
        updatedAt: now,
        updatedBy: currentUid,
        previousTitle: existing.title,
        previousAmount: existing.amount,
      },
    ],
  };

  const notif: LedgerNotification = {
    id: `notif-edit-${Date.now()}`,
    ledgerId: params.ledgerId,
    recipientUid: "all",
    message: `管理者已修改支出「${updatedTx.title}」（原為「${existing.title}」 ${existing.amount} 元 → 更新為 ${updatedTx.amount} 元），系統已重新計算各成員餘額`,
    createdAt: now,
    read: false,
  };

  const nextState: AppDatabaseState = {
    ...state,
    transactions: {
      ...state.transactions,
      [params.ledgerId]: txList.map((t) =>
        t.id === params.transactionId ? updatedTx : t,
      ),
    },
    notifications: [notif, ...state.notifications],
  };
  saveAppState(nextState);
  return { nextState, transaction: updatedTx };
}

export function deleteExpenseInState(
  state: AppDatabaseState,
  params: { ledgerId: string; transactionId: string },
): { nextState: AppDatabaseState; error?: string } {
  const currentUid = state.currentUserUid;
  const ledger = state.ledgers[params.ledgerId];
  if (!currentUid || !ledger) {
    return { nextState: state, error: "找不到帳本" };
  }
  const role = ledger.roles[currentUid];
  if (role !== "Owner" && role !== "Editor") {
    return { nextState: state, error: "僅群組管理者或編輯者可刪除支出" };
  }

  const txList = state.transactions[params.ledgerId] ?? [];
  const target = txList.find((t) => t.id === params.transactionId);
  if (!target) {
    return { nextState: state, error: "找不到該筆支出" };
  }

  const now = new Date().toISOString();
  const notif: LedgerNotification = {
    id: `notif-del-${Date.now()}`,
    ledgerId: params.ledgerId,
    recipientUid: "all",
    message: `管理者已刪除支出「${target.title}」（${target.amount} 元），系統已重新計算各成員餘額`,
    createdAt: now,
    read: false,
  };

  const nextState: AppDatabaseState = {
    ...state,
    transactions: {
      ...state.transactions,
      [params.ledgerId]: txList.filter((t) => t.id !== params.transactionId),
    },
    notifications: [notif, ...state.notifications],
  };
  saveAppState(nextState);
  return { nextState };
}

/**
 * User Story 7：標記還款與確認收款
 */
export function createRepaymentInState(
  state: AppDatabaseState,
  params: {
    ledgerId: string;
    fromUid: string;
    toUid: string;
    amount: number;
  },
): { nextState: AppDatabaseState; error?: string; repayment?: Repayment } {
  const ledger = state.ledgers[params.ledgerId];
  if (!ledger) {
    return { nextState: state, error: "找不到帳本" };
  }

  const txList = state.transactions[params.ledgerId] ?? [];
  const repList = state.repayments[params.ledgerId] ?? [];
  const netBalances = calculateNetBalances(ledger.members, txList, repList);

  const check = validateRepaymentAmount({
    netBalances,
    fromUid: params.fromUid,
    toUid: params.toUid,
    amount: params.amount,
  });

  if (!check.valid) {
    return { nextState: state, error: check.error };
  }

  const now = new Date().toISOString();
  const repayment: Repayment = {
    id: `rep-${Date.now()}`,
    ledgerId: params.ledgerId,
    fromUid: params.fromUid,
    toUid: params.toUid,
    amount: params.amount,
    status: "pending",
    createdAt: now,
  };

  const fromName =
    ledger.memberProfiles[params.fromUid]?.displayName ?? params.fromUid;
  const toName =
    ledger.memberProfiles[params.toUid]?.displayName ?? params.toUid;

  const notif: LedgerNotification = {
    id: `notif-rep-${Date.now()}`,
    ledgerId: params.ledgerId,
    recipientUid: params.toUid,
    message: `${fromName} 已標記還款 ${params.amount} 元給 ${toName}，等待收款人確認`,
    createdAt: now,
    read: false,
  };

  const nextState: AppDatabaseState = {
    ...state,
    repayments: {
      ...state.repayments,
      [params.ledgerId]: [repayment, ...repList],
    },
    notifications: [notif, ...state.notifications],
  };
  saveAppState(nextState);
  return { nextState, repayment };
}

export function confirmRepaymentInState(
  state: AppDatabaseState,
  params: { ledgerId: string; repaymentId: string },
): { nextState: AppDatabaseState; error?: string } {
  const ledger = state.ledgers[params.ledgerId];
  if (!ledger) {
    return { nextState: state, error: "找不到帳本" };
  }
  const repList = state.repayments[params.ledgerId] ?? [];
  const target = repList.find((r) => r.id === params.repaymentId);
  if (!target) {
    return { nextState: state, error: "找不到還款紀錄" };
  }

  const now = new Date().toISOString();
  const fromName =
    ledger.memberProfiles[target.fromUid]?.displayName ?? target.fromUid;
  const toName =
    ledger.memberProfiles[target.toUid]?.displayName ?? target.toUid;

  const notif: LedgerNotification = {
    id: `notif-rep-confirm-${Date.now()}`,
    ledgerId: params.ledgerId,
    recipientUid: target.fromUid,
    message: `${toName} 已確認收到 ${fromName} 的還款 ${target.amount} 元，雙方餘額已更新`,
    createdAt: now,
    read: false,
  };

  const nextState: AppDatabaseState = {
    ...state,
    repayments: {
      ...state.repayments,
      [params.ledgerId]: repList.map((r) =>
        r.id === params.repaymentId
          ? { ...r, status: "confirmed", confirmedAt: now }
          : r,
      ),
    },
    notifications: [notif, ...state.notifications],
  };
  saveAppState(nextState);
  return { nextState };
}

/**
 * User Story 9：管理群組成員（移除成員，必須沒有未結清款項）
 */
export function removeMemberFromLedgerInState(
  state: AppDatabaseState,
  params: { ledgerId: string; targetUid: string },
): { nextState: AppDatabaseState; error?: string } {
  const currentUid = state.currentUserUid;
  const ledger = state.ledgers[params.ledgerId];
  if (!currentUid || !ledger) {
    return { nextState: state, error: "找不到帳本" };
  }
  if (ledger.roles[currentUid] !== "Owner") {
    return { nextState: state, error: "僅群組管理者可移除成員" };
  }
  if (params.targetUid === currentUid) {
    return { nextState: state, error: "群組管理者不可移除自己" };
  }

  const txList = state.transactions[params.ledgerId] ?? [];
  const repList = state.repayments[params.ledgerId] ?? [];
  const netBalances = calculateNetBalances(ledger.members, txList, repList);

  const check = canRemoveMember({
    targetUid: params.targetUid,
    netBalances,
    pendingRepayments: repList,
  });

  if (!check.allowed) {
    return { nextState: state, error: check.error };
  }

  const removedProfile = ledger.memberProfiles[params.targetUid];
  const nextRoles = { ...ledger.roles };
  delete nextRoles[params.targetUid];
  const nextProfiles = { ...ledger.memberProfiles };
  delete nextProfiles[params.targetUid];

  const now = new Date().toISOString();
  const updatedLedger: Ledger = {
    ...ledger,
    members: ledger.members.filter((m) => m !== params.targetUid),
    roles: nextRoles,
    memberProfiles: nextProfiles,
    updatedAt: now,
  };

  const notif: LedgerNotification = {
    id: `notif-remove-${Date.now()}`,
    ledgerId: params.ledgerId,
    recipientUid: params.targetUid,
    message: `成員「${removedProfile?.displayName ?? params.targetUid}」已由群組管理者移出群組「${ledger.name}」`,
    createdAt: now,
    read: false,
  };

  const nextState: AppDatabaseState = {
    ...state,
    ledgers: {
      ...state.ledgers,
      [params.ledgerId]: updatedLedger,
    },
    notifications: [notif, ...state.notifications],
  };
  saveAppState(nextState);
  return { nextState };
}
