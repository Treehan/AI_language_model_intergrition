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

### Firebase Authentication 設定

正式登入需要在 `.env.local` 設定 Firebase Web App 的公開設定值，並在 Firebase Console 啟用 Email/Password 與 Phone 登入方式：

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=your-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-web-app-id
```

Email 註冊會寄送 Firebase 電子郵件驗證信，完成驗證後才能登入。手機登入使用 Firebase SMS 驗證碼；Firebase Phone Authentication 不支援以密碼登入，因此與「電子郵件或手機號碼 + 密碼」的故事規格不同。測試環境使用隔離的假登入邊界，不會傳送 SMS 或呼叫 Firebase。

目前帳本、支出與還款流程仍以瀏覽器 `localStorage` 為資料來源；Firebase Auth 不代表帳本資料已同步至 Firestore。跨裝置共享及雲端持久化仍需完成 Firestore 整合與規則驗證後才能視為可用。

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
