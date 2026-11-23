import { beforeEach, describe, expect, it } from "vitest";
import {
  addExpenseInState,
  confirmRepaymentInState,
  createInitialAppState,
  createLedgerInState,
  createRepaymentInState,
  loadAppState,
  joinLedgerByInviteInState,
  type AppDatabaseState,
} from "../../src/lib/ledgers/index";

describe("ledger service validation and authorization", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("removes legacy passwords and persisted login identities during migration", () => {
    const initial = createInitialAppState();
    const legacy = {
      ...initial,
      currentUserUid: "user-owner-1",
      users: {
        ...initial.users,
        "user-owner-1": {
          ...initial.users["user-owner-1"]!,
          password: "legacy-secret",
        },
      },
    };
    localStorage.setItem("tw_split_ledger_app_state_v1", JSON.stringify(legacy));

    const loaded = loadAppState();
    const persisted = localStorage.getItem("tw_split_ledger_app_state_v1") ?? "";

    expect(loaded.currentUserUid).toBeNull();
    expect(loaded.users["user-owner-1"]).not.toHaveProperty("password");
    expect(persisted).not.toContain("legacy-secret");
    expect(persisted).not.toContain('"currentUserUid":"user-owner-1"');
  });

  it("creates owner-ledgers and allows invited users to join with member permissions", () => {
    const state: AppDatabaseState = {
      ...createInitialAppState(),
      currentUserUid: "user-owner-1",
    };
    const created = createLedgerInState(state, {
      name: "  東京旅行  ",
      currency: "JPY",
    });

    expect(created.ledger?.name).toBe("東京旅行");
    expect(created.ledger?.roles["user-owner-1"]).toBe("Owner");

    const joinState = {
      ...created.nextState,
      currentUserUid: "user-member-2",
    };
    const joined = joinLedgerByInviteInState(
      joinState,
      `https://example.test/ledgers?invite=${created.ledger?.invite.code}`,
    );
    expect(joined.ledger?.members).toContain("user-member-2");
    expect(joined.ledger?.roles["user-member-2"]).toBe("Member");

    const invalidCurrency = createLedgerInState(state, {
      name: "無效幣別",
      currency: "XYZ" as "JPY",
    });
    expect(invalidCurrency.error).toBe("請選擇有效的帳本幣別");
  });

  it("validates expense dates, categories, payer membership, participants, and caps", () => {
    const state: AppDatabaseState = {
      ...createInitialAppState(),
      currentUserUid: "user-owner-1",
    };
    const basePayload = {
      ledgerId: "ledger-taipei-trip",
      title: "晚餐",
      amount: 100,
      payerId: "user-owner-1",
      date: "2026-11-16",
      category: "餐飲" as const,
      splitMethod: "equal" as const,
      participants: ["user-owner-1", "user-member-2"],
    };

    expect(
      addExpenseInState(state, { ...basePayload, date: "2026-02-30" }).error,
    ).toBe("請輸入有效的支出日期");
    expect(
      addExpenseInState(state, {
        ...basePayload,
        category: "錯誤類別" as "餐飲",
      }).error,
    ).toBe("請選擇有效的支出類別");
    expect(
      addExpenseInState(state, { ...basePayload, payerId: "outsider" }).error,
    ).toBe("付款人必須是群組成員");
    expect(
      addExpenseInState(state, {
        ...basePayload,
        participants: ["user-owner-1", "user-owner-1"],
      }).error,
    ).toBe("請勿重複選擇分攤成員");
    expect(
      addExpenseInState(state, {
        ...basePayload,
        participants: ["user-owner-1", "outsider"],
      }).error,
    ).toBe("分攤成員必須是群組成員");
    expect(
      addExpenseInState(state, {
        ...basePayload,
        amount: 1_000_000_000_001,
      }).error,
    ).toBe("金額不可超過 1,000,000,000,000 元");

    const added = addExpenseInState(state, basePayload);
    expect(added.transaction?.splits).toEqual({
      "user-owner-1": 50,
      "user-member-2": 50,
    });
  });

  it("restricts repayments to the authenticated debtor and recipient", () => {
    const base = createInitialAppState();
    const debtorState: AppDatabaseState = {
      ...base,
      currentUserUid: "user-member-3",
    };
    expect(
      createRepaymentInState(debtorState, {
        ledgerId: "ledger-taipei-trip",
        fromUid: "user-owner-1",
        toUid: "user-member-2",
        amount: 100,
      }).error,
    ).toBe("只能標記自己的還款");

    const created = createRepaymentInState(debtorState, {
      ledgerId: "ledger-taipei-trip",
      fromUid: "user-member-3",
      toUid: "user-member-2",
      amount: 100,
    });
    expect(created.repayment?.status).toBe("pending");
    expect(
      createRepaymentInState(created.nextState, {
        ledgerId: "ledger-taipei-trip",
        fromUid: "user-member-3",
        toUid: "user-member-2",
        amount: 1,
      }).error,
    ).toBe("目前對該成員沒有待還款項");

    expect(
      confirmRepaymentInState(created.nextState, {
        ledgerId: "ledger-taipei-trip",
        repaymentId: created.repayment!.id,
      }).error,
    ).toBe("只有收款人可以確認這筆還款");

    const recipientState = {
      ...created.nextState,
      currentUserUid: "user-member-2",
    };
    const confirmed = confirmRepaymentInState(recipientState, {
      ledgerId: "ledger-taipei-trip",
      repaymentId: created.repayment!.id,
    });
    expect(confirmed.nextState.repayments["ledger-taipei-trip"]?.[0]?.status).toBe(
      "confirmed",
    );
  });
});
