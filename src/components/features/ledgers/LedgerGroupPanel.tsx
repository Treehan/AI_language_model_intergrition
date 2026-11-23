"use client";

/**
 * 帳本管理與成員權限 UI 元件 (components/features/ledgers/)
 * 遵循 ARCHITECTURE.md 第三大支柱：純 UI 元件僅透過 props 接收資料與事件回呼，
 * 嚴禁在內部直接查詢 Firestore 或執行分帳運算。
 */
import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrencyInteger } from "@/lib/finance";
import type { CurrencyCode, Ledger, LedgerRole } from "@/types/ledger";

export interface LedgerGroupPanelProps {
  ledgers: Ledger[];
  activeLedger: Ledger | null;
  firebaseMode?: boolean;
  currentUserUid: string;
  currentUserRole: LedgerRole;
  netBalances: Record<string, number>;
  feedbackError?: string | null;
  feedbackSuccess?: string | null;
  onSelectLedger: (ledgerId: string) => void;
  onCreateLedger: (
    name: string,
    currency: CurrencyCode,
  ) => void | Promise<boolean>;
  onJoinLedger: (inviteCodeOrUrl: string) => void | Promise<void>;
  onToggleInviteActive: (
    ledgerId: string,
    active: boolean,
  ) => void | Promise<void>;
  onRemoveMember: (
    ledgerId: string,
    targetUid: string,
  ) => void | Promise<void>;
}

const ROLE_LABELS: Record<LedgerRole, string> = {
  Owner: "群組管理者",
  Editor: "編輯成員",
  Member: "一般成員",
  Viewer: "檢視成員",
};

export function LedgerGroupPanel({
  ledgers,
  activeLedger,
  firebaseMode = false,
  currentUserUid,
  currentUserRole,
  netBalances,
  feedbackError,
  feedbackSuccess,
  onSelectLedger,
  onCreateLedger,
  onJoinLedger,
  onToggleInviteActive,
  onRemoveMember,
}: LedgerGroupPanelProps) {
  const [newGroupName, setNewGroupName] = React.useState("");
  const [newGroupCurrency, setNewGroupCurrency] =
    React.useState<CurrencyCode>("TWD");
  const [inviteInput, setInviteInput] = React.useState<string | null>(null);

  const subscribeToLocation = React.useCallback((callback: () => void) => {
    window.addEventListener("popstate", callback);
    return () => window.removeEventListener("popstate", callback);
  }, []);
  const inviteOrigin = React.useSyncExternalStore(
    subscribeToLocation,
    () => window.location.origin,
    () => "https://ai-language-model-intergrition.web.app",
  );
  const inviteFromUrl = React.useSyncExternalStore(
    subscribeToLocation,
    () => {
      const url = new URL(window.location.href);
      return firebaseMode
        ? url.searchParams.has("ledger")
          ? url.href
          : ""
        : url.searchParams.get("invite") ?? "";
    },
    () => "",
  );
  const inviteInputValue = inviteInput ?? inviteFromUrl;
  const inviteLink = activeLedger
    ? firebaseMode
      ? `${inviteOrigin}/ledgers?ledger=${encodeURIComponent(activeLedger.id)}`
      : `${inviteOrigin}/ledgers?invite=${encodeURIComponent(activeLedger.invite.code)}`
    : "";

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await onCreateLedger(newGroupName, newGroupCurrency);
    if (created && newGroupName.trim()) {
      setNewGroupName("");
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onJoinLedger(inviteInputValue);
  };

  return (
    <div className="space-y-6">
      {feedbackError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
        >
          {feedbackError}
        </div>
      )}
      {feedbackSuccess && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {feedbackSuccess}
        </div>
      )}

      {/* 帳本切換器與建立/加入群組 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* User Story 2：建立記帳群組 */}
        <Card>
          <CardHeader>
            <CardTitle>建立記帳群組</CardTitle>
            <CardDescription>
              建立新的共用帳本並自動產生專屬邀請連結與 QR Code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="group-name-input"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  群組名稱
                </label>
                <Input
                  id="group-name-input"
                  placeholder="例如：沖繩五天四夜自由行"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="group-currency-select"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  帳本幣別
                </label>
                <select
                  id="group-currency-select"
                  value={newGroupCurrency}
                  onChange={(e) =>
                    setNewGroupCurrency(e.target.value as CurrencyCode)
                  }
                  className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="TWD">新台幣 (TWD)</option>
                  <option value="JPY">日圓 (JPY)</option>
                  <option value="USD">美元 (USD)</option>
                  <option value="EUR">歐元 (EUR)</option>
                  <option value="KRW">韓元 (KRW)</option>
                </select>
              </div>
              <Button type="submit" className="w-full">
                建立群組
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* User Story 3：透過邀請連結或邀請碼加入群組 */}
        <Card>
          <CardHeader>
            <CardTitle>透過邀請連結加入群組</CardTitle>
            <CardDescription>
              {firebaseMode
                ? "貼上群組管理者提供的完整邀請連結"
                : "輸入群組邀請連結或邀請碼（測試失效連結可輸入 EXPIRED2025）"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="invite-code-input"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  {firebaseMode ? "邀請連結" : "邀請連結或邀請碼"}
                </label>
                <Input
                  id="invite-code-input"
                  placeholder={
                    firebaseMode
                      ? "貼上完整邀請連結"
                      : "貼上邀請連結或輸入邀請碼，如 HUALIEN2026"
                  }
                  value={inviteInputValue}
                  onChange={(e) => setInviteInput(e.target.value)}
                />
              </div>
              <Button type="submit" variant="outline" className="w-full">
                加入群組
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 目前帳本資訊、邀請連結與 QR Code、成員管理 */}
      {activeLedger && <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>目前帳本：{activeLedger.name}</CardTitle>
              <CardDescription>
                幣別：{activeLedger.currency} ｜ 您的身分：
                {ROLE_LABELS[currentUserRole]}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {ledgers.map((l) => (
                <Button
                  key={l.id}
                  type="button"
                  size="sm"
                  variant={l.id === activeLedger.id ? "default" : "outline"}
                  onClick={() => onSelectLedger(l.id)}
                >
                  {l.name}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 邀請連結與 SVG QR Code 區塊 */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    群組邀請連結與 QR Code
                  </span>
                  <Badge
                    variant={
                      activeLedger.invite.active ? "success" : "destructive"
                    }
                  >
                    {activeLedger.invite.active ? "邀請連結啟用中" : "已失效"}
                  </Badge>
                </div>
                <p
                  data-testid="ledger-invite-link"
                  className="break-all font-mono text-xs text-slate-700"
                >
                  {inviteLink}
                </p>
                {!firebaseMode && (
                  <p className="text-xs text-slate-500">
                    邀請碼：
                    <strong data-testid="ledger-invite-code">
                      {activeLedger.invite.code}
                    </strong>
                  </p>
                )}
                {currentUserRole === "Owner" && (
                  <div className="pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onToggleInviteActive(
                          activeLedger.id,
                          !activeLedger.invite.active,
                        )
                      }
                    >
                      {activeLedger.invite.active
                        ? "關閉邀請連結"
                        : "重新啟用邀請連結"}
                    </Button>
                  </div>
                )}
              </div>

              {/* 內嵌 QR Code 視覺化元件 */}
              <div
                aria-label="群組邀請 QR Code"
                className="flex flex-col items-center rounded-lg border border-slate-200 bg-white p-3 shadow-xs"
              >
                <QRCodeSVG
                  value={inviteLink}
                  size={120}
                  includeMargin
                  title={`群組邀請連結 QR Code：${activeLedger.invite.code}`}
                />
                <span className="mt-1 text-[11px] font-medium text-slate-600">
                  QR Code
                </span>
              </div>
            </div>
          </div>

          {/* User Story 9：管理群組成員 */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">
              群組成員名單（共 {activeLedger.members.length} 人）
            </h4>
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
              {activeLedger.members.map((uid) => {
                const profile = activeLedger.memberProfiles[uid];
                const role = activeLedger.roles[uid] ?? "Member";
                const balance = netBalances[uid] ?? 0;

                return (
                  <div
                    key={uid}
                    data-testid={`member-row-${uid}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {profile?.displayName ?? uid}
                        </span>
                        <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>
                        {uid === currentUserUid && (
                          <Badge variant="outline">本人</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {profile?.email ?? ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-semibold ${
                          balance > 0
                            ? "text-emerald-700"
                            : balance < 0
                              ? "text-rose-700"
                              : "text-slate-600"
                        }`}
                      >
                        {balance > 0
                          ? `應收 ${formatCurrencyInteger(balance, activeLedger.currency)}`
                          : balance < 0
                            ? `應付 ${formatCurrencyInteger(-balance, activeLedger.currency)}`
                            : "已結清 (0 元)"}
                      </span>

                      {currentUserRole === "Owner" &&
                        uid !== currentUserUid && (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            aria-label={`移除${profile?.displayName ?? uid}`}
                            onClick={() =>
                              onRemoveMember(activeLedger.id, uid)
                            }
                          >
                            移除
                          </Button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>}
    </div>
  );
}
