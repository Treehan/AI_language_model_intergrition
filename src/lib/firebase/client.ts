/**
 * Firebase Client SDK 初始化（僅限瀏覽器端與 Client Components 使用）
 * 遵循 ARCHITECTURE.md 第四節：與 Admin SDK 嚴格隔離
 */
import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";

function getFirebaseConfig() {
  const values = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const missingSettings = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missingSettings.length > 0) {
    throw new Error(
      `Firebase 設定不完整，請檢查 .env.local：${missingSettings.join(", ")}`,
    );
  }
  return {
    apiKey: values.apiKey ?? "",
    authDomain: values.authDomain ?? "",
    projectId: values.projectId ?? "",
    storageBucket: values.storageBucket ?? "",
    messagingSenderId: values.messagingSenderId ?? "",
    appId: values.appId ?? "",
  };
}

export function isFirebaseEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FIREBASE_ENABLED === "true";
}

/**
 * 取得或初始化 Firebase Client App
 */
export function getFirebaseClientApp(): FirebaseApp {
  const config = getFirebaseConfig();
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(config);
}

/**
 * 取得 Firebase Authentication 實例
 */
export function getFirebaseClientAuth(): Auth {
  return getAuth(getFirebaseClientApp());
}

/**
 * 取得 Cloud Firestore 實例
 */
export function getFirebaseClientDb(): Firestore {
  return getFirestore(getFirebaseClientApp());
}
