/**
 * Firebase Client SDK 初始化（僅限瀏覽器端與 Client Components 使用）
 * 遵循 ARCHITECTURE.md 第四節：與 Admin SDK 嚴格隔離
 */
import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyD80XTOSsZ7iEL3_t-_mDMTHiuoEE0F41U",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "ai-language-model-intergrition.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    "ai-language-model-intergrition",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "ai-language-model-intergrition.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "480766533329",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:480766533329:web:f06201c7d2df140025eff0",
};

/**
 * 取得或初始化 Firebase Client App
 */
export function getFirebaseClientApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
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
