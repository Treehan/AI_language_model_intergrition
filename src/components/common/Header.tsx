"use client";

/**
 * 全站頂部導覽列與帳號管理對話框 (components/common/Header.tsx)
 * 涵蓋 User Story 1：使用 Firebase Authentication 建立帳號與登入。
 */
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  confirmPhoneVerificationCode,
  createPhoneRecaptchaVerifier,
  getAuthErrorMessage,
  isTestAuthEnabledForUi,
  loginEmailAccount,
  normalizeTaiwanPhoneNumber,
  registerEmailAccount,
  sendPhoneVerificationCode,
  type AuthenticatedProfile,
} from "@/lib/firebase/auth";
import type { UserProfile } from "@/types/ledger";

export interface AppHeaderProps {
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  testAuthEnabled: boolean;
  authError?: string | null;
  authSuccess?: string | null;
  onDeleteAccount: () => Promise<boolean>;
  onAuthProfileChanged: (profile: AuthenticatedProfile) => void;
  onSwitchTestUser: (uid: string) => void;
  onLogout: () => void;
}

export function AppHeader({
  currentUser,
  allUsers,
  testAuthEnabled,
  authError,
  authSuccess,
  onDeleteAccount,
  onAuthProfileChanged,
  onSwitchTestUser,
  onLogout,
}: AppHeaderProps) {
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<"register" | "login">(
    "register",
  );
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [phoneCode, setPhoneCode] = React.useState("");
  const [phoneCodeSent, setPhoneCodeSent] = React.useState(false);
  const [localAuthError, setLocalAuthError] = React.useState<string | null>(
    null,
  );
  const [localAuthSuccess, setLocalAuthSuccess] = React.useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = React.useState(false);
  const phoneVerifier = React.useRef<ReturnType<
    typeof createPhoneRecaptchaVerifier
  > | null>(null);

  const isPhoneIdentifier =
    identifier.trim().length > 0 &&
    !identifier.includes("@") &&
    /^[+\d()\s-]+$/.test(identifier);

  const resetPhoneVerification = () => {
    phoneVerifier.current?.clear();
    phoneVerifier.current = null;
    setPhoneCode("");
    setPhoneCodeSent(false);
  };

  const changeAuthMode = (mode: "register" | "login") => {
    setAuthMode(mode);
    setLocalAuthError(null);
    setLocalAuthSuccess(null);
    resetPhoneVerification();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalAuthError(null);
    setLocalAuthSuccess(null);
    setSubmitting(true);
    try {
      if (isPhoneIdentifier) {
        if (authMode === "register" && !displayName.trim()) {
          throw new Error("請輸入暱稱");
        }
        const phoneNumber = normalizeTaiwanPhoneNumber(identifier);
        if (!phoneCodeSent) {
          phoneVerifier.current?.clear();
          phoneVerifier.current = createPhoneRecaptchaVerifier(
            "phone-recaptcha-container",
          );
          await sendPhoneVerificationCode(
            phoneNumber,
            phoneVerifier.current,
          );
          setPhoneCodeSent(true);
          setLocalAuthSuccess("已傳送簡訊驗證碼，請輸入收到的 6 位數驗證碼");
          return;
        }
        const profile = await confirmPhoneVerificationCode({
          code: phoneCode,
          displayName: authMode === "register" ? displayName : undefined,
        });
        onAuthProfileChanged(profile);
        setLocalAuthSuccess(
          authMode === "register"
            ? `歡迎 ${displayName.trim()}！已完成手機驗證並登入`
            : "手機驗證成功，已登入",
        );
        resetPhoneVerification();
        setIdentifier("");
        setPhoneCode("");
        setDisplayName("");
        setShowAuthModal(false);
      } else if (authMode === "register") {
        await registerEmailAccount({ email: identifier, password, displayName });
        setLocalAuthSuccess(
          isTestAuthEnabledForUi()
            ? `歡迎 ${displayName.trim()}！已成功建立帳號並登入`
            : "驗證信已寄出，請先完成電子郵件驗證，再返回登入。",
        );
        if (isTestAuthEnabledForUi()) {
          setIdentifier("");
          setPassword("");
          setDisplayName("");
          setShowAuthModal(false);
        } else {
          setPassword("");
        }
      } else {
        await loginEmailAccount({ email: identifier, password });
        setLocalAuthSuccess("登入成功");
        setIdentifier("");
        setPassword("");
        setShowAuthModal(false);
      }
    } catch (error) {
      setLocalAuthError(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white shadow-xs">
            帳
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              小組記帳與分帳 App
            </h1>
            <p className="text-xs text-slate-500">
              嚴格整數金額運算 ｜ 多人共用帳本與即時最少轉帳結算
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currentUser ? (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs">
                <span className="text-slate-500">目前登入會員：</span>
                <strong
                  data-testid="current-user-name"
                  className="text-slate-900"
                >
                  {currentUser.displayName}
                </strong>
                <Badge variant="success">已登入</Badge>
              </div>

              {testAuthEnabled && (
                <select
                  aria-label="快速切換測試會員"
                  value={currentUser.uid}
                  onChange={(e) => onSwitchTestUser(e.target.value)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800"
                >
                  {allUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      測試：{u.displayName} ({u.email})
                    </option>
                  ))}
                </select>
              )}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  changeAuthMode("register");
                  setShowAuthModal((v) => !v);
                }}
              >
                帳號管理 / 建立帳號
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onLogout}
              >
                登出
              </Button>
            </>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  changeAuthMode("register");
                  setShowAuthModal(true);
                }}
              >
                建立帳號
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  changeAuthMode("login");
                  setShowAuthModal(true);
                }}
              >
                登入
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* User Story 1：建立帳號 / 登入表單面板 */}
      {(showAuthModal || !currentUser) && (
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-5">
          <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={authMode === "register" ? "default" : "outline"}
                  onClick={() => changeAuthMode("register")}
                >
                  建立個人帳號
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={authMode === "login" ? "default" : "outline"}
                  onClick={() => changeAuthMode("login")}
                >
                  會員登入
                </Button>
              </div>
              {currentUser && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAuthModal(false)}
                >
                  關閉
                </Button>
              )}
            </div>

            {(localAuthError || authError) && (
              <div
                role="alert"
                className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
              >
                {localAuthError ?? authError}
              </div>
            )}
            {(localAuthSuccess || authSuccess) && (
              <div
                role="status"
                className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
              >
                {localAuthSuccess ?? authSuccess}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="auth-identifier-input"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  電子郵件或手機號碼
                </label>
                <Input
                  id="auth-identifier-input"
                  placeholder="例如：newuser@example.com 或 0912345678"
                  value={identifier}
                  autoComplete="username"
                  onChange={(e) => {
                    if (phoneCodeSent) {
                      resetPhoneVerification();
                    }
                    setLocalAuthError(null);
                    setIdentifier(e.target.value);
                  }}
                />
              </div>

              {isPhoneIdentifier ? (
                <>
                  {authMode === "register" && (
                    <div>
                      <label
                        htmlFor="auth-nickname-input"
                        className="mb-1 block text-xs font-medium text-slate-700"
                      >
                        暱稱
                      </label>
                      <Input
                        id="auth-nickname-input"
                        placeholder="請輸入您的顯示暱稱"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </div>
                  )}
                  {phoneCodeSent && (
                    <div>
                      <label
                        htmlFor="auth-phone-code-input"
                        className="mb-1 block text-xs font-medium text-slate-700"
                      >
                        簡訊驗證碼
                      </label>
                      <Input
                        id="auth-phone-code-input"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={phoneCode}
                        onChange={(e) =>
                          setPhoneCode(e.target.value.replace(/\D/g, ""))
                        }
                      />
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    手機登入使用 Firebase 簡訊驗證；Firebase 手機登入不支援密碼。
                  </p>
                  <div id="phone-recaptcha-container" />
                </>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="auth-password-input"
                      className="mb-1 block text-xs font-medium text-slate-700"
                    >
                      密碼
                    </label>
                    <Input
                      id="auth-password-input"
                      type="password"
                      autoComplete={
                        authMode === "register"
                          ? "new-password"
                          : "current-password"
                      }
                      placeholder="請輸入密碼（至少 6 碼）"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {authMode === "register" && (
                    <div>
                      <label
                        htmlFor="auth-nickname-input"
                        className="mb-1 block text-xs font-medium text-slate-700"
                      >
                        暱稱
                      </label>
                      <Input
                        id="auth-nickname-input"
                        placeholder="請輸入您的顯示暱稱"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? "處理中…"
                  : isPhoneIdentifier
                    ? phoneCodeSent
                      ? authMode === "register"
                        ? "驗證並建立帳號"
                        : "驗證並登入"
                      : "傳送驗證碼"
                    : authMode === "register"
                      ? "建立帳號"
                      : "登入"}
              </Button>
            </form>

            {/* 刪除個人帳號區塊 */}
            {currentUser && (
              <div className="mt-5 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-rose-700">
                      危險操作區域：刪除個人帳號
                    </p>
                    <p className="text-[11px] text-slate-500">
                      目前帳號：{currentUser.displayName}（{currentUser.email}
                      ）。必須在所有群組皆無未結清款項才可刪除。
                    </p>
                  </div>
                  {!confirmingDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmingDelete(true)}
                    >
                      刪除帳號
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          const ok = await onDeleteAccount();
                          if (ok) {
                            setConfirmingDelete(false);
                            setShowAuthModal(false);
                          }
                          }}
                      >
                        確認刪除帳號
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmingDelete(false)}
                      >
                        取消
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
