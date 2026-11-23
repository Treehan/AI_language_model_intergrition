import { describe, expect, it } from "vitest";
import { createInitialAppState } from "../../src/lib/ledgers";
import {
  createLedgerCsvFilename,
  createTransactionsCsv,
} from "../../src/lib/transactions/export";

describe("transaction CSV export", () => {
  const state = createInitialAppState();
  const ledger = state.ledgers["ledger-taipei-trip"]!;

  it("writes a UTF-8 BOM and escapes punctuation and line breaks", () => {
    const transaction = state.transactions["ledger-taipei-trip"]![0]!;
    const csv = createTransactionsCsv(ledger, [
      { ...transaction, title: 'Lunch, "special"\nmeal' },
    ]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Lunch, ""special""\nmeal"');
    expect(csv).toContain('"陳小美"');
    expect(csv).not.toContain("alice@example.com");
  });

  it("exports a header for an empty result and creates a safe dated filename", () => {
    const csv = createTransactionsCsv(ledger, []);
    expect(csv).toContain('"日期","項目","類別"');
    expect(csv.split("\r\n")).toHaveLength(1);
    expect(
      createLedgerCsvFilename(" 東京/旅行 ", new Date("2026-03-04T00:00:00.000Z")),
    ).toBe("東京_旅行-支出紀錄-2026-03-04.csv");
  });
});
