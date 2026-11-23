import fs from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "demo-shared-ledger-rules-test";

describe("Firestore Security Rules 多人共用帳本與防竄改權限驗證", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rulesPath = path.resolve(import.meta.dirname, "../../firestore.rules");
    const rules = fs.readFileSync(rulesPath, "utf8");
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, "ledgers", "ledger-1"), {
        name: "台北聚餐帳本",
        currency: "TWD",
        members: ["owner-uid", "editor-uid", "member-uid", "viewer-uid"],
        roles: {
          "owner-uid": "Owner",
          "editor-uid": "Editor",
          "member-uid": "Member",
          "viewer-uid": "Viewer",
        },
        invite: {
          code: "INVITE123",
          active: true,
          expiresAt: "2028-01-01T00:00:00.000Z",
          createdBy: "owner-uid",
        },
      });
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it("拒絕未登入或非帳本成員讀取與修改帳本 (Pillar 2)", async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthDb, "ledgers", "ledger-1")));

    const outsiderDb = testEnv.authenticatedContext("outsider-uid").firestore();
    await assertFails(getDoc(doc(outsiderDb, "ledgers", "ledger-1")));
    await assertFails(
      updateDoc(doc(outsiderDb, "ledgers", "ledger-1"), {
        name: "被駭客竄改的帳本",
      }),
    );
  });

  it("允許帳本成員讀取帳本，且僅允許 Owner 修改帳本名稱", async () => {
    const memberDb = testEnv.authenticatedContext("member-uid").firestore();
    await assertSucceeds(getDoc(doc(memberDb, "ledgers", "ledger-1")));
    await assertFails(
      updateDoc(doc(memberDb, "ledgers", "ledger-1"), {
        name: "一般成員嘗試改名",
      }),
    );

    const ownerDb = testEnv.authenticatedContext("owner-uid").firestore();
    await assertSucceeds(
      updateDoc(doc(ownerDb, "ledgers", "ledger-1"), {
        name: "台北週末旅遊帳本",
      }),
    );
  });

  it("防竄改交易 (Tamper-Proof Transactions)：一般成員 (Member) 只能建立自己付款的支出，不能偽造他人為付款人", async () => {
    const memberDb = testEnv.authenticatedContext("member-uid").firestore();

    // 一般成員建立自己付款的正整數交易 -> 允許
    await assertSucceeds(
      setDoc(doc(memberDb, "ledgers", "ledger-1", "transactions", "tx-ok"), {
        title: "午餐",
        amount: 300,
        payerId: "member-uid",
        createdBy: "member-uid",
      }),
    );

    // 一般成員嘗試建立聲稱由 owner-uid 付款的交易 -> 拒絕！
    await assertFails(
      setDoc(doc(memberDb, "ledgers", "ledger-1", "transactions", "tx-spoof"), {
        title: "偽造他人付款",
        amount: 500,
        payerId: "owner-uid",
        createdBy: "member-uid",
      }),
    );

    // 具備 Editor 權限的成員可代其他群組成員建立交易 -> 允許
    const editorDb = testEnv.authenticatedContext("editor-uid").firestore();
    await assertSucceeds(
      setDoc(
        doc(editorDb, "ledgers", "ledger-1", "transactions", "tx-editor"),
        {
          title: "代記門票",
          amount: 1000,
          payerId: "member-uid",
          createdBy: "editor-uid",
        },
      ),
    );

    // Viewer 角色不可新增任何交易 -> 拒絕！
    const viewerDb = testEnv.authenticatedContext("viewer-uid").firestore();
    await assertFails(
      setDoc(
        doc(viewerDb, "ledgers", "ledger-1", "transactions", "tx-viewer"),
        {
          title: "檢視者嘗試新增",
          amount: 100,
          payerId: "viewer-uid",
          createdBy: "viewer-uid",
        },
      ),
    );
  });

  it("強制整數金額驗證 (Pillar 1)：拒絕小於等於 0 或浮點數金額寫入 Firestore", async () => {
    const ownerDb = testEnv.authenticatedContext("owner-uid").firestore();

    await assertFails(
      setDoc(doc(ownerDb, "ledgers", "ledger-1", "transactions", "tx-zero"), {
        title: "零元交易",
        amount: 0,
        payerId: "owner-uid",
        createdBy: "owner-uid",
      }),
    );

    await assertFails(
      setDoc(doc(ownerDb, "ledgers", "ledger-1", "transactions", "tx-float"), {
        title: "浮點數交易",
        amount: 99.95,
        payerId: "owner-uid",
        createdBy: "owner-uid",
      }),
    );
  });

  it("個人帳號刪除權限驗證：僅允許本人刪除自己的帳號檔案，拒絕他人代刪", async () => {
    const aliceDb = testEnv.authenticatedContext("alice-uid").firestore();
    const bobDb = testEnv.authenticatedContext("bob-uid").firestore();

    await assertSucceeds(
      setDoc(doc(aliceDb, "users", "alice-uid"), {
        uid: "alice-uid",
        email: "alice@example.com",
        displayName: "陳小美",
      }),
    );

    // 他人嘗試刪除 alice 帳號 -> 拒絕
    await assertFails(deleteDoc(doc(bobDb, "users", "alice-uid")));

    // 本人刪除自己的帳號 -> 允許
    await assertSucceeds(deleteDoc(doc(aliceDb, "users", "alice-uid")));
  });
});
