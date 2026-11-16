import { beforeEach, describe, expect, it } from "vitest";
import {
  createPhoneRecaptchaVerifier,
  getAuthErrorMessage,
  loginEmailAccount,
  normalizeTaiwanPhoneNumber,
  registerEmailAccount,
  subscribeToAuthState,
  switchTestAuthUser,
} from "../../src/lib/firebase/auth";

describe("Firebase Authentication boundary", () => {
  beforeEach(() => {
    switchTestAuthUser("user-owner-1");
  });

  it("normalizes Taiwan mobile numbers and rejects invalid input", () => {
    expect(normalizeTaiwanPhoneNumber("0912-345-678")).toBe("+886912345678");
    expect(normalizeTaiwanPhoneNumber("+886 912345678")).toBe("+886912345678");
    expect(() => normalizeTaiwanPhoneNumber("123")).toThrow(
      "請輸入有效的台灣手機號碼，例如 0912345678",
    );
  });

  it("prevents test mode from simulating SMS verification codes", () => {
    expect(() => createPhoneRecaptchaVerifier("recaptcha")).toThrow(
      "測試環境不會傳送手機驗證簡訊",
    );
  });

  it("uses the provider boundary for email registration without persisting passwords", async () => {
    let activeUid = "";
    const unsubscribe = subscribeToAuthState((profile) => {
      activeUid = profile?.uid ?? "";
    });

    await registerEmailAccount({
      email: `member-${crypto.randomUUID()}@example.com`,
      password: "secret-password",
      displayName: "新會員",
    });

    expect(activeUid).toMatch(/^test-/);
    expect(localStorage.getItem("tw_split_ledger_app_state_v1")).toBeNull();
    unsubscribe();
  });

  it("reports duplicate email accounts and maps Firebase provider errors", async () => {
    await expect(
      registerEmailAccount({
        email: "ALICE@example.com",
        password: "secret-password",
        displayName: "重複會員",
      }),
    ).rejects.toThrow("此帳號已存在，請直接登入");

    await expect(
      loginEmailAccount({
        email: "alice@example.com",
        password: "password123",
      }),
    ).resolves.toBeUndefined();
    expect(
      getAuthErrorMessage({ code: "auth/operation-not-allowed" }),
    ).toBe("Firebase 尚未啟用此登入方式，請聯絡管理者");
    expect(getAuthErrorMessage(new Error("Firebase 尚未完成設定"))).toBe(
      "Firebase 尚未完成設定",
    );
  });
});
