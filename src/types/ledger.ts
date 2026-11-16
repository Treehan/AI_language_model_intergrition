/**
 * 帳本與權限模型定義
 * 遵循 ARCHITECTURE.md 規範：嚴格型別定義，禁止使用 any
 */

/** 帳本成員角色 */
export type LedgerRole = "Owner" | "Editor" | "Member" | "Viewer";

/** 支援的幣別代碼 */
export type CurrencyCode = "TWD" | "JPY" | "USD" | "EUR" | "KRW";

/** 群組成員詳細資訊 */
export interface LedgerMemberProfile {
  uid: string;
  displayName: string;
  email: string;
  joinedAt: string;
}

/** 邀請連結狀態 */
export interface LedgerInvite {
  code: string;
  active: boolean;
  expiresAt: string;
  createdBy: string;
}

/** 共用帳本模型 */
export interface Ledger {
  id: string;
  name: string;
  currency: CurrencyCode;
  /** 成員 UID 陣列，供 Firestore Security Rules 檢查成員資格 */
  members: string[];
  /** 成員角色對應表 (UID -> Role) */
  roles: Record<string, LedgerRole>;
  /** 成員顯示資訊對應表 (UID -> Profile) */
  memberProfiles: Record<string, LedgerMemberProfile>;
  /** 群組邀請連結設定 */
  invite: LedgerInvite;
  createdAt: string;
  updatedAt: string;
}

/** 使用者帳號模型 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  createdAt: string;
}

/** 系統通知訊息模型 */
export interface LedgerNotification {
  id: string;
  ledgerId: string;
  recipientUid: string;
  message: string;
  createdAt: string;
  read: boolean;
}
