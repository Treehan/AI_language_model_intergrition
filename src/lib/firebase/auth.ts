import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseClientAuth, getFirebaseClientDb } from "@/lib/firebase/client";
import { userProfileConverter } from "@/lib/firebase/converters";
import type { UserProfile } from "@/types/ledger";

function getUserProfileReference(uid: string) {
  return doc(
    collection(getFirebaseClientDb(), "users").withConverter(
      userProfileConverter,
    ),
    uid,
  );
}

export async function registerFirebaseAccount(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<UserProfile> {
  const credential = await createUserWithEmailAndPassword(
    getFirebaseClientAuth(),
    params.email.trim(),
    params.password,
  );
  await updateProfile(credential.user, {
    displayName: params.displayName.trim(),
  });

  const profile: UserProfile = {
    uid: credential.user.uid,
    email: credential.user.email ?? params.email.trim(),
    displayName: credential.user.displayName ?? params.displayName.trim(),
    createdAt: new Date().toISOString(),
  };
  await setDoc(getUserProfileReference(profile.uid), profile);
  return profile;
}

export async function signInFirebaseAccount(
  email: string,
  password: string,
): Promise<void> {
  await signInWithEmailAndPassword(
    getFirebaseClientAuth(),
    email.trim(),
    password,
  );
}

export async function signOutFirebaseAccount(): Promise<void> {
  await signOut(getFirebaseClientAuth());
}

export async function getOrCreateFirebaseUserProfile(
  user: User,
): Promise<UserProfile> {
  const profileReference = getUserProfileReference(user.uid);
  const existing = await getDoc(profileReference);
  if (existing.exists()) {
    return existing.data();
  }

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? user.email?.split("@")[0] ?? "新會員",
    createdAt: new Date().toISOString(),
  };
  await setDoc(profileReference, profile);
  return profile;
}

export function getFirebaseAuthErrorMessage(error: unknown): string {
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
      return "請輸入至少 6 碼的密碼";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "電子郵件或密碼不正確，請重新確認";
    case "auth/too-many-requests":
      return "嘗試次數過多，請稍後再試";
    case "auth/network-request-failed":
      return "網路連線失敗，請檢查網路後再試";
    default:
      return error instanceof Error
        ? `Firebase 操作失敗：${error.message}`
        : "Firebase 操作失敗，請稍後再試";
  }
}
