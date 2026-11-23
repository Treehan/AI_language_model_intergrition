"use client";

/**
 * 全站頂部導覽列與帳號管理對話框 (components/common/Header.tsx)
 * 涵蓋 User Story 1：建立帳號（含重複帳號檢查提示「此帳號已存在，請直接登入」）与快速切換測試帳號。
 */
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserProfile } from "@/types/ledger";

export interface AppHeaderProps {
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  firebaseMode?: boolean;
  authError?: string | null;
  authSuccess?: string | null;
  onRegisterAccount: (params: {
    identifier: string;
    password: string;
    displayName: string;
  }) => boolean | Promise<boolean>;
  onLoginAccount: (
    params: { identifier: string; password: string },
  ) => boolean | Promise<boolean>;
  onDeleteAccount: () => boolean;
  onSwitchUser: (uid: string) => void;
  onLogout: () => void | Promise<void>;
}

export function AppHeader({
  currentUser,
  allUsers,
  firebaseMode = false,
  authError,
  authSuccess,
  onRegisterAccount,
  onLoginAccount,
  onDeleteAccount,
  onSwitchUser,
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
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (authMode === "register") {
        const ok = await onRegisterAccount({ identifier, password, displayName });
        if (ok) {
          setIdentifier("");
          setPassword("");
          setDisplayName("");
          setShowAuthModal(false);
        }
      } else {
        const ok = await onLoginAccount({ identifier, password });
        if (ok) {
          setIdentifier("");
          setPassword("");
          setShowAuthModal(false);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
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

              {/* 方便切換不同群組角色測試權限 */}
              {!firebaseMode && <select
                aria-label="快速切換測試會員"
                value={currentUser.uid}
                onChange={(e) => onSwitchUser(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800"
              >
                {allUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    切換：{u.displayName} ({u.email})
                  </option>
                ))}
              </select>}

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setAuthMode("register");
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
                  setAuthMode("register");
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
                  setAuthMode("login");
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
                  onClick={() => setAuthMode("register")}
                >
                  建立個人帳號
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={authMode === "login" ? "default" : "outline"}
                  onClick={() => setAuthMode("login")}
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

            {authError && (
              <div
                role="alert"
                className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
              >
                {authError}
              </div>
            )}
            {authSuccess && (
              <div
                role="status"
                className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
              >
                {authSuccess}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="auth-identifier-input"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  {firebaseMode ? "電子郵件" : "電子郵件或手機號碼"}
                </label>
                <Input
                  id="auth-identifier-input"
                  type={firebaseMode ? "email" : "text"}
                  aria-label={firebaseMode ? "電子郵件" : undefined}
                  placeholder={
                    firebaseMode
                      ? "例如：newuser@example.com"
                      : "例如：newuser@example.com 或 0912345678"
                  }
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
                {firebaseMode && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Firebase 登入目前使用電子郵件與密碼。
                  </p>
                )}
              </div>

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
                  placeholder="請輸入密碼（至少 6 碼）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
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
                    required
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {authMode === "register" ? "建立帳號" : "登入"}
              </Button>
            </form>

            {/* 刪除個人帳號區塊 */}
            {currentUser && !firebaseMode && (
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
                        onClick={() => {
                          const ok = onDeleteAccount();
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
