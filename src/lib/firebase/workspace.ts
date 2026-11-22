import {
  collection,
  doc,
  arrayUnion,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
  type CollectionReference,
  type Unsubscribe,
} from "firebase/firestore";
import {
  getLedgersCollection,
  getNotificationsCollection,
  getRepaymentsCollection,
  getTransactionsCollection,
  getUsersCollection,
  type AppDatabaseState,
} from "@/lib/ledgers";
import { getFirebaseClientDb } from "@/lib/firebase/client";
import type {
  Ledger,
  LedgerNotification,
  UserProfile,
} from "@/types/ledger";
import type { Repayment, Transaction } from "@/types/transaction";

function syncCollection<T>(
  batch: ReturnType<typeof writeBatch>,
  target: CollectionReference<T>,
  previous: Record<string, T>,
  next: Record<string, T>,
): number {
  let writes = 0;
  for (const [id, value] of Object.entries(next)) {
    if (JSON.stringify(previous[id]) === JSON.stringify(value)) {
      continue;
    }
    batch.set(doc(target, id), value);
    writes += 1;
  }
  for (const id of Object.keys(previous)) {
    if (id in next) {
      continue;
    }
    batch.delete(doc(target, id));
    writes += 1;
  }
  return writes;
}

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

export async function persistAppStateChanges(
  previous: AppDatabaseState,
  next: AppDatabaseState,
): Promise<void> {
  const batch = writeBatch(getFirebaseClientDb());
  let writes = syncCollection<UserProfile>(
    batch,
    getUsersCollection(),
    previous.users,
    next.users,
  );
  writes += syncCollection<Ledger>(
    batch,
    getLedgersCollection(),
    previous.ledgers,
    next.ledgers,
  );

  const ledgerIds = new Set([
    ...Object.keys(previous.transactions),
    ...Object.keys(next.transactions),
  ]);
  for (const ledgerId of ledgerIds) {
    writes += syncCollection<Transaction>(
      batch,
      getTransactionsCollection(ledgerId),
      indexById(previous.transactions[ledgerId] ?? []),
      indexById(next.transactions[ledgerId] ?? []),
    );
  }

  const repaymentLedgerIds = new Set([
    ...Object.keys(previous.repayments),
    ...Object.keys(next.repayments),
  ]);
  for (const ledgerId of repaymentLedgerIds) {
    writes += syncCollection<Repayment>(
      batch,
      getRepaymentsCollection(ledgerId),
      indexById(previous.repayments[ledgerId] ?? []),
      indexById(next.repayments[ledgerId] ?? []),
    );
  }

  const notificationLedgerIds = new Set([
    ...previous.notifications.map((notification) => notification.ledgerId),
    ...next.notifications.map((notification) => notification.ledgerId),
  ]);
  for (const ledgerId of notificationLedgerIds) {
    writes += syncCollection<LedgerNotification>(
      batch,
      getNotificationsCollection(ledgerId),
      indexById(
        previous.notifications.filter(
          (notification) => notification.ledgerId === ledgerId,
        ),
      ),
      indexById(
        next.notifications.filter(
          (notification) => notification.ledgerId === ledgerId,
        ),
      ),
    );
  }

  if (writes > 0) {
    await batch.commit();
  }
}

export function createFirebaseDocumentId(collectionName: string): string {
  return doc(collection(getFirebaseClientDb(), collectionName)).id;
}

export async function joinFirebaseLedgerByInvite(params: {
  ledgerId: string;
  uid: string;
  displayName: string;
  email: string;
}): Promise<void> {
  await updateDoc(doc(getFirebaseClientDb(), "ledgers", params.ledgerId), {
    members: arrayUnion(params.uid),
    [`roles.${params.uid}`]: "Editor",
    [`memberProfiles.${params.uid}`]: {
      uid: params.uid,
      displayName: params.displayName,
      email: params.email,
      joinedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  });
}

export function subscribeToFirebaseWorkspace(
  uid: string,
  profile: UserProfile,
  onChange: (state: AppDatabaseState) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  let currentProfile = profile;
  let ledgers: Record<string, Ledger> = {};
  const transactions: Record<string, Transaction[]> = {};
  const repayments: Record<string, Repayment[]> = {};
  const notifications: Record<string, LedgerNotification[]> = {};
  const ledgerSubscriptions = new Map<string, Unsubscribe[]>();

  const emit = () => {
    onChange({
      users: { [uid]: currentProfile },
      currentUserUid: uid,
      ledgers,
      transactions,
      repayments,
      notifications: Object.values(notifications).flat(),
    });
  };

  const profileSubscription = onSnapshot(
    doc(getUsersCollection(), uid),
    (snapshot) => {
      if (snapshot.exists()) {
        currentProfile = snapshot.data();
        emit();
      }
    },
    onError,
  );

  const ledgerSubscription = onSnapshot(
    query(getLedgersCollection(), where("members", "array-contains", uid)),
    (snapshot) => {
      ledgers = Object.fromEntries(
        snapshot.docs.map((ledgerDocument) => [
          ledgerDocument.id,
          ledgerDocument.data(),
        ]),
      );

      for (const [ledgerId, subscriptions] of ledgerSubscriptions) {
        if (ledgerId in ledgers) {
          continue;
        }
        subscriptions.forEach((unsubscribe) => unsubscribe());
        ledgerSubscriptions.delete(ledgerId);
        delete transactions[ledgerId];
        delete repayments[ledgerId];
        delete notifications[ledgerId];
      }

      for (const ledgerId of Object.keys(ledgers)) {
        if (ledgerSubscriptions.has(ledgerId)) {
          continue;
        }
        const subscriptions = [
          onSnapshot(
            getTransactionsCollection(ledgerId),
            (collectionSnapshot) => {
              if (!(ledgerId in ledgers)) {
                return;
              }
              transactions[ledgerId] = collectionSnapshot.docs.map((entry) =>
                entry.data(),
              );
              emit();
            },
            onError,
          ),
          onSnapshot(
            getRepaymentsCollection(ledgerId),
            (collectionSnapshot) => {
              if (!(ledgerId in ledgers)) {
                return;
              }
              repayments[ledgerId] = collectionSnapshot.docs.map((entry) =>
                entry.data(),
              );
              emit();
            },
            onError,
          ),
          onSnapshot(
            getNotificationsCollection(ledgerId),
            (collectionSnapshot) => {
              if (!(ledgerId in ledgers)) {
                return;
              }
              notifications[ledgerId] = collectionSnapshot.docs.map((entry) =>
                entry.data(),
              );
              emit();
            },
            onError,
          ),
        ];
        ledgerSubscriptions.set(ledgerId, subscriptions);
      }
      emit();
    },
    onError,
  );

  return () => {
    profileSubscription();
    ledgerSubscription();
    for (const subscriptions of ledgerSubscriptions.values()) {
      subscriptions.forEach((unsubscribe) => unsubscribe());
    }
  };
}
