# 小組記帳與分帳 App

以繁體中文（台灣）設計的多人共用帳本與分帳應用程式，嚴格遵循 [ARCHITECTURE.md](./ARCHITECTURE.md) 三大核心支柱：

1. **財務計算絕對整數化（Pillar 1）**：全面禁止浮點數運算，所有金額與分攤餘數皆以整數最小單位計算與儲存，並於 `src/lib/finance/` 達成 100% 單元測試覆蓋率。
2. **共用帳本最小權限安全規則（Pillar 2）**：於 `firestore.rules` 實作基於角色（`Owner`、`Editor`、`Member`、`Viewer`）之存取控制與交易付款人防偽造驗證，並透過 Firebase Emulator 規則測試驗證。
3. **純粹顯示層與 SDK 嚴格隔離（Pillar 3）**：`src/components/features/*` 僅透過 props 接收資料與事件，且 Firebase Client SDK (`src/lib/firebase/client.ts`) 與 Admin SDK (`src/lib/firebase/server.ts`) 嚴格分離，所有集合存取皆使用 `withConverter<T>()`。

## 開發與啟動

```bash
npm ci
npm run dev
```

### Firebase 雲端設定

將 `.env.example` 複製為 `.env.local`，填入 Firebase Web App 設定值，並將 `NEXT_PUBLIC_FIREBASE_ENABLED` 設為 `true`。Firebase Console 需啟用 Email/Password 登入及 Firestore；Email 註冊須先完成驗證信確認才能登入。Phone 登入使用 SMS 驗證碼，不使用密碼。

Firebase 模式下，登入者的帳本、支出、還款與通知會同步至 Firestore 並即時更新；關閉 `NEXT_PUBLIC_FIREBASE_ENABLED` 則使用本機範例資料。`.env.local` 已被 Git 忽略。Firebase Web 設定不是服務帳戶憑證，勿將 Service Account 私鑰或帳號密碼放入此檔。

雲端邀請連結可作為加入憑證，請勿公開張貼。現行 Firestore 規則尚未驗證邀請期限或邀請碼，也未限制加入操作只能變更該成員資料；在規則完成強化並部署前，請勿將連結分享給不受信任的人。

## 驗證與測試命令

```bash
# ESLint 靜態檢查
npm run lint

# Vitest 單元測試（含 src/lib/finance 100% 覆蓋率驗證）
npm run test:unit

# Firestore Security Rules 模擬器權限與防竄改測試
npm run test:rules

# Playwright 端對端測試（涵蓋 User Stories 1–10 完整驗收情境）
npm run test:e2e

# 生產環境建置與 TypeScript 型別驗證
npm run build
```
