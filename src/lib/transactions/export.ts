import type { Ledger } from "@/types/ledger";
import type { Transaction } from "@/types/transaction";

function escapeCsvField(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function createTransactionsCsv(
  ledger: Pick<Ledger, "currency" | "memberProfiles">,
  transactions: readonly Transaction[],
): string {
  const rows = [
    [
      "日期",
      "項目",
      "類別",
      "付款人",
      `金額（${ledger.currency}）`,
      "分帳方式",
      "分攤明細",
    ],
    ...transactions.map((transaction) => [
      transaction.date,
      transaction.title,
      transaction.category,
      ledger.memberProfiles[transaction.payerId]?.displayName ??
        transaction.payerId,
      transaction.amount,
      transaction.splitMethod === "equal" ? "平均分攤" : "指定金額",
      Object.entries(transaction.splits)
        .map(
          ([uid, amount]) =>
            `${ledger.memberProfiles[uid]?.displayName ?? uid}: ${amount}`,
        )
        .join("；"),
    ]),
  ];

  return `\uFEFF${rows
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\r\n")}`;
}

export function createLedgerCsvFilename(
  ledgerName: string,
  date = new Date(),
): string {
  const safeLedgerName = ledgerName
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .slice(0, 80);
  const dateStamp = date.toISOString().slice(0, 10);
  return `${safeLedgerName || "帳本"}-支出紀錄-${dateStamp}.csv`;
}
