/**
 * Firestore 強型別資料轉換器 (withConverter<T>)
 * 遵循 ARCHITECTURE.md 第四節：所有集合操作均須使用 withConverter 確保型別安全與整數金額驗證
 */
import type {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from "firebase/firestore";
import { assertSafeIntegerAmount } from "@/lib/finance";
import type {
  Ledger,
  LedgerNotification,
  UserProfile,
} from "@/types/ledger";
import type { Repayment, Transaction } from "@/types/transaction";

export const userProfileConverter: FirestoreDataConverter<UserProfile> = {
  toFirestore(profile: UserProfile): DocumentData {
    return {
      uid: profile.uid,
      email: profile.email,
      displayName: profile.displayName,
      phone: profile.phone ?? "",
      createdAt: profile.createdAt,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions,
  ): UserProfile {
    const data = snapshot.data(options);
    return {
      uid: String(data.uid ?? snapshot.id),
      email: String(data.email ?? ""),
      displayName: String(data.displayName ?? ""),
      phone: data.phone ? String(data.phone) : undefined,
      createdAt: String(data.createdAt ?? new Date().toISOString()),
    };
  },
};

export const ledgerConverter: FirestoreDataConverter<Ledger> = {
  toFirestore(ledger: Ledger): DocumentData {
    return {
      name: ledger.name,
      currency: ledger.currency,
      members: ledger.members,
      roles: ledger.roles,
      memberProfiles: ledger.memberProfiles,
      invite: ledger.invite,
      createdAt: ledger.createdAt,
      updatedAt: ledger.updatedAt,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions,
  ): Ledger {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      name: String(data.name ?? ""),
      currency: (data.currency ?? "TWD") as Ledger["currency"],
      members: Array.isArray(data.members)
        ? data.members.map((m: unknown) => String(m))
        : [],
      roles: (data.roles ?? {}) as Ledger["roles"],
      memberProfiles: (data.memberProfiles ?? {}) as Ledger["memberProfiles"],
      invite: (data.invite ?? {
        code: "",
        active: false,
        expiresAt: "",
        createdBy: "",
      }) as Ledger["invite"],
      createdAt: String(data.createdAt ?? ""),
      updatedAt: String(data.updatedAt ?? ""),
    };
  },
};

export const transactionConverter: FirestoreDataConverter<Transaction> = {
  toFirestore(tx: Transaction): DocumentData {
    assertSafeIntegerAmount(tx.amount, "交易儲存金額");
    for (const share of Object.values(tx.splits)) {
      assertSafeIntegerAmount(share, "分攤儲存金額");
    }
    return {
      ledgerId: tx.ledgerId,
      title: tx.title,
      amount: tx.amount,
      payerId: tx.payerId,
      createdBy: tx.createdBy,
      date: tx.date,
      category: tx.category,
      splitMethod: tx.splitMethod,
      participants: tx.participants,
      splits: tx.splits,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
      history: tx.history,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions,
  ): Transaction {
    const data = snapshot.data(options);
    const amount = Number(data.amount ?? 0);
    assertSafeIntegerAmount(amount, "讀取交易金額");
    return {
      id: snapshot.id,
      ledgerId: String(data.ledgerId ?? ""),
      title: String(data.title ?? ""),
      amount,
      payerId: String(data.payerId ?? ""),
      createdBy: String(data.createdBy ?? ""),
      date: String(data.date ?? ""),
      category: (data.category ?? "其他") as Transaction["category"],
      splitMethod: (data.splitMethod ?? "equal") as Transaction["splitMethod"],
      participants: Array.isArray(data.participants)
        ? data.participants.map((p: unknown) => String(p))
        : [],
      splits: (data.splits ?? {}) as Record<string, number>,
      createdAt: String(data.createdAt ?? ""),
      updatedAt: String(data.updatedAt ?? ""),
      history: Array.isArray(data.history)
        ? (data.history as Transaction["history"])
        : [],
    };
  },
};

export const repaymentConverter: FirestoreDataConverter<Repayment> = {
  toFirestore(rep: Repayment): DocumentData {
    assertSafeIntegerAmount(rep.amount, "還款儲存金額");
    const data: DocumentData = {
      ledgerId: rep.ledgerId,
      fromUid: rep.fromUid,
      toUid: rep.toUid,
      amount: rep.amount,
      status: rep.status,
      createdAt: rep.createdAt,
    };
    if (rep.confirmedAt) {
      data.confirmedAt = rep.confirmedAt;
    }
    return data;
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions,
  ): Repayment {
    const data = snapshot.data(options);
    const amount = Number(data.amount ?? 0);
    assertSafeIntegerAmount(amount, "讀取還款金額");
    return {
      id: snapshot.id,
      ledgerId: String(data.ledgerId ?? ""),
      fromUid: String(data.fromUid ?? ""),
      toUid: String(data.toUid ?? ""),
      amount,
      status: (data.status ?? "pending") as Repayment["status"],
      createdAt: String(data.createdAt ?? ""),
      confirmedAt: data.confirmedAt ? String(data.confirmedAt) : undefined,
    };
  },
};

export const notificationConverter: FirestoreDataConverter<LedgerNotification> = {
  toFirestore(notif: LedgerNotification): DocumentData {
    return {
      ledgerId: notif.ledgerId,
      recipientUid: notif.recipientUid,
      message: notif.message,
      createdAt: notif.createdAt,
      read: notif.read,
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options: SnapshotOptions,
  ): LedgerNotification {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      ledgerId: String(data.ledgerId ?? ""),
      recipientUid: String(data.recipientUid ?? ""),
      message: String(data.message ?? ""),
      createdAt: String(data.createdAt ?? ""),
      read: Boolean(data.read),
    };
  },
};
