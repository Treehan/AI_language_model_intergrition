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
