import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  updateProfile,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

export interface AuthenticatedProfile {
  uid: string;
  email: string;
  phone: string;
  displayName: string;
}

const isTestAuthEnabled =
  process.env.NODE_ENV !== "production" &&
  (process.env.NODE_ENV === "test" ||
    process.env.NEXT_PUBLIC_ENABLE_TEST_AUTH === "true");

const testProfiles: Record<string, AuthenticatedProfile> = {
  "user-owner-1": {
    uid: "user-owner-1",
    email: "alice@example.com",
    phone: "0912345678",
    displayName: "陳小美",
  },
  "user-member-2": {
    uid: "user-member-2",
    email: "bob@example.com",
    phone: "0922333444",
    displayName: "林大明",
  },
  "user-member-3": {
    uid: "user-member-3",
    email: "carol@example.com",
    phone: "0933555666",
    displayName: "張雅婷",
  },
  "user-settled-4": {
    uid: "user-settled-4",
    email: "david@example.com",
    phone: "0944777888",
    displayName: "王志豪",
  },
};

let testCurrentProfile: AuthenticatedProfile | null = isTestAuthEnabled
  ? testProfiles["user-owner-1"]!
  : null;
let pendingPhoneConfirmation: ConfirmationResult | null = null;
const authStateListeners = new Set<
  (profile: AuthenticatedProfile | null) => void
>();

function notifyTestAuthListeners(): void {
  for (const listener of authStateListeners) {
    listener(testCurrentProfile);
  }
}

function profileFromFirebaseUser(user: User): AuthenticatedProfile {
  return {
    uid: user.uid,
    email: user.email ?? "",
    phone: user.phoneNumber ?? "",
    displayName: user.displayName ?? "",
  };
}

export function subscribeToAuthState(
  listener: (profile: AuthenticatedProfile | null) => void,
): () => void {
  if (isTestAuthEnabled) {
    authStateListeners.add(listener);
    listener(testCurrentProfile);
    return () => authStateListeners.delete(listener);
  }

  return onAuthStateChanged(getFirebaseClientAuth(), (user) => {
    if (!user) {
      listener(null);
      return;
    }
    listener(profileFromFirebaseUser(user));
  });
}

export function validateEmailOnly(input: string): void {
  const trimmed = input.trim();
  if (/^[+\d()\s-]+$/.test(trimmed) || /^09\d+/.test(trimmed)) {
    throw new Error("僅支援電子郵件，不支援使用手機號碼登入或註冊");
  }
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error("請輸入有效的電子郵件地址");
  }
}

export async function registerEmailAccount(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  const displayName = params.displayName.trim();
  validateEmailOnly(email);
  if (params.password.length < 6) {
    throw new Error("請輸入至少 6 碼的密碼");
  }
  if (!displayName) {
    throw new Error("請輸入暱稱");
  }

  if (isTestAuthEnabled) {
    if (
      Object.values(testProfiles).some(
        (profile) => profile.email.toLowerCase() === email,
      )
    ) {
      throw new Error("此帳號已存在，請直接登入");
    }
    const profile: AuthenticatedProfile = {
      uid: `test-${crypto.randomUUID()}`,
      email,
      phone: "",
      displayName,
    };
    testProfiles[profile.uid] = profile;
    testCurrentProfile = profile;
    notifyTestAuthListeners();
    return;
  }

  const auth = getFirebaseClientAuth();
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    params.password,
  );
  await updateProfile(credential.user, { displayName });
}

export async function loginEmailAccount(params: {
  email: string;
  password: string;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  if (!email || !params.password) {
    throw new Error("請輸入電子郵件與密碼");
  }
  validateEmailOnly(email);

  if (isTestAuthEnabled) {
    const profile = Object.values(testProfiles).find(
      (candidate) => candidate.email.toLowerCase() === email,
    );
    if (!profile) {
      throw new Error("找不到此帳號，請先建立帳號");
    }
    testCurrentProfile = profile;
    notifyTestAuthListeners();
    return;
  }

  await signInWithEmailAndPassword(
    getFirebaseClientAuth(),
    email,
    params.password,
  );
}

export function createPhoneRecaptchaVerifier(
  containerId: string,
): RecaptchaVerifier {
  if (isTestAuthEnabled) {
    throw new Error("測試環境不會傳送手機驗證簡訊");
  }
  return new RecaptchaVerifier(
    getFirebaseClientAuth(),
    containerId,
    { size: "invisible" },
  );
}

export function normalizeTaiwanPhoneNumber(input: string): string {
  const normalized = input.trim().replace(/[()\s-]/g, "");
  if (/^09\d{8}$/.test(normalized)) {
    return `+886${normalized.slice(1)}`;
  }
  if (/^8869\d{8}$/.test(normalized)) {
    return `+${normalized}`;
  }
  if (/^\+8869\d{8}$/.test(normalized)) {
    return normalized;
  }
  throw new Error("請輸入有效的台灣手機號碼，例如 0912345678");
}

export async function sendPhoneVerificationCode(
  phoneNumber: string,
  verifier: RecaptchaVerifier,
): Promise<void> {
  pendingPhoneConfirmation = await signInWithPhoneNumber(
    getFirebaseClientAuth(),
    normalizeTaiwanPhoneNumber(phoneNumber),
    verifier,
  );
}

export async function confirmPhoneVerificationCode(params: {
  code: string;
  displayName?: string;
}): Promise<AuthenticatedProfile> {
  if (!/^\d{6}$/.test(params.code)) {
    throw new Error("請輸入簡訊中的 6 位數驗證碼");
  }
  if (!pendingPhoneConfirmation) {
    throw new Error("請先傳送手機驗證碼");
  }

  const credential = await pendingPhoneConfirmation.confirm(params.code);
  pendingPhoneConfirmation = null;
  if (params.displayName?.trim()) {
    await updateProfile(credential.user, {
      displayName: params.displayName.trim(),
    });
  }
  return profileFromFirebaseUser(credential.user);
}

export async function signOutCurrentUser(): Promise<void> {
  if (isTestAuthEnabled) {
    testCurrentProfile = null;
    notifyTestAuthListeners();
    return;
  }
  await signOut(getFirebaseClientAuth());
}

export async function deleteCurrentAuthUser(): Promise<void> {
  if (isTestAuthEnabled) {
    testCurrentProfile = null;
    notifyTestAuthListeners();
    return;
  }
  const auth = getFirebaseClientAuth();
  if (!auth.currentUser) {
    throw new Error("請先登入再刪除帳號");
  }
  await deleteUser(auth.currentUser);
}

export function switchTestAuthUser(uid: string): void {
  if (!isTestAuthEnabled) {
    throw new Error("測試會員切換功能僅供測試使用");
  }
  const profile = testProfiles[uid];
  if (!profile) {
    throw new Error("找不到測試會員");
  }
  testCurrentProfile = profile;
  notifyTestAuthListeners();
}

export function isTestAuthEnabledForUi(): boolean {
  return isTestAuthEnabled;
}

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && !("code" in error)) {
    return error.message;
  }
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  switch (code) {
    case "auth/email-already-in-use":
      return "此帳號已存在，請直接登入";
    case "auth/invalid-email":
      return "請輸入有效的電子郵件地址";
    case "auth/weak-password":
      return "密碼至少需要 6 碼";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "帳號或密碼不正確，請重新輸入";
    case "auth/too-many-requests":
      return "嘗試次數過多，請稍後再試";
    case "auth/invalid-phone-number":
      return "請輸入有效的手機號碼";
    case "auth/invalid-verification-code":
      return "手機驗證碼不正確，請重新輸入";
    case "auth/code-expired":
      return "手機驗證碼已過期，請重新傳送";
    case "auth/captcha-check-failed":
      return "人機驗證失敗，請重新嘗試";
    case "auth/operation-not-allowed":
      return "Firebase 尚未啟用此登入方式，請聯絡管理者";
    case "auth/unauthorized-domain":
      return "目前網域尚未加入 Firebase Authentication 授權清單";
    default:
      return "驗證失敗，請檢查網路連線或稍後再試";
  }
}
