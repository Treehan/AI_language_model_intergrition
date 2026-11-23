/**
 * Firebase Admin SDK 初始化（僅限伺服器端 Route Handlers / Server Actions 使用）
 * 嚴格禁止匯入至任何 Client Component！
 */
import {
  type App as AdminApp,
  cert,
  getApps as getAdminApps,
  initializeApp as initializeAdminApp,
} from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

export function getFirebaseAdminApp(): AdminApp {
  const existing = getAdminApps();
  if (existing.length > 0 && existing[0]) {
    return existing[0];
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    "ai-language-model-intergrition";

  if (
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return initializeAdminApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      projectId,
    });
  }

  return initializeAdminApp({ projectId });
}

export function getServerAuth() {
  return getAdminAuth(getFirebaseAdminApp());
}

export function getServerDb() {
  return getAdminFirestore(getFirebaseAdminApp());
}
