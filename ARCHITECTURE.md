# System Architecture and Engineering Guidelines (ARCHITECTURE.md)

## 1. Core Tech Stack
- **Framework:** Next.js (App Router, defaults to React Server Components)
- **Language:** TypeScript (Strict Mode, strict type checking, using `any` is strictly prohibited)
- **Styling & UI:** Tailwind CSS, shadcn/ui (based on Radix UI primitives), CSS variable themes
- **Backend & Database:** Firebase (Authentication, Cloud Firestore, Cloud Storage)
- **Testing Framework:** Vitest (Unit/Integration Testing), Playwright (End-to-End E2E Testing)

---

## 2. Directory Structure and Responsibilities

```text
├── app/                           # App Router (路由、版型、Server Components)
│   ├── (auth)/                    # 路由群組：驗證相關流程 (登入/註冊)
│   ├── (dashboard)/               # 路由群組：需登入的個人主頁 (如帳本列表)
│   ├── ledgers/                   # 路由群組：共用帳本明細、交易紀錄與分帳畫面
│   ├── api/                       # Route Handlers (伺服器端 API 端點)
│   ├── layout.tsx                 # 全域根版型 (佈景主題與 Provider)
│   └── globals.css                # 全域樣式與 Tailwind CSS 變數 (Design Tokens)
├── components/
│   ├── ui/                        # shadcn/ui 底層元件 (透過 CLI 安裝，純樣式原語)
│   ├── common/                    # 全站共用元件 (如 Header、Sidebar、Footer)
│   └── features/                  # 依領域劃分的複合功能元件
│       ├── ledgers/               # 帳本管理相關 UI 元件
│       ├── transactions/          # 記帳與收支明細 UI 元件
│       └── settlements/           # 分帳演算法結果與結算 UI 元件
├── lib/
│   ├── finance/                   # 金額計算核心邏輯 (嚴格整數運算、分帳演算法)
│   ├── firebase/
│   │   ├── client.ts              # Firebase Client SDK 初始化 (僅限瀏覽器端)
│   │   ├── server.ts              # Firebase Admin SDK 初始化 (僅限伺服器端)
│   │   └── converters.ts          # Firestore typed withConverter 資料轉換器
│   ├── ledgers/                   # 帳本權限與資料操作 Service 函式
│   └── utils.ts                   # 全域共用工具函式 (如 cn() class 合併器)
├── types/
│   ├── ledger.ts                  # 帳本與權限模型定義 (TypeScript Interfaces)
│   └── transaction.ts             # 交易紀錄模型定義
├── tests/
│   ├── unit/                      # Vitest 單元測試 (特別針對金額與分帳邏輯)
│   ├── rules/                     # Firebase Emulator 安全規則測試 (驗證帳本權限)
│   └── e2e/                       # Playwright 瀏覽器端對端測試
├── firestore.rules                # Cloud Firestore 安全規則 (實作多人共用帳本權限)
└── storage.rules                  # Firebase Storage 存取規則 (如群組頭像、收據上傳)


3. Core Architecture Principles (The Three Pillars)

Pillar 1: Financial Computation Integrity (Absolute Ban on Floating-Point Numbers)

⚬ No Floating-Point Math: Using standard JavaScript Number (floating-point) for currency calculations is STRICTLY PROHIBITED to avoid precision loss (e.g., 0.1 + 0.2 !== 0.3).
⚬ Integer-Only Storage & Calculation: All monetary values MUST be stored in Firestore and manipulated in memory as integers representing the smallest currency unit (e.g., cents, or standard NTD integer values).
⚬ Display Layer Conversion: Only convert the integer to a formatted string with decimals (if applicable to the currency) at the absolute final presentation layer in React components.
⚬ Algorithms: Bill splitting algorithms (e.g., debt simplification) must be encapsulated as pure functions in lib/finance/ and handle exact division remainders (e.g., allocating the leftover 1 cent to a specific user) explicitly.

Pillar 2: Shared Ledger Authorization (Strict Security Rules)

⚬ Role-Based Access Control (RBAC): Every ledger must have an explicit members array and a roles map (e.g., Owner, Editor, Viewer).
⚬ Backend-Enforced Security: Client-side UI hiding is NOT enough. Firestore Security Rules (firestore.rules) MUST strictly enforce that only authenticated users present in the ledger's members array can read or write documents within that specific ledger.
  ⚬ Example logic: allow read, write: if request.auth.uid in resource.data.members;
⚬ Tamper-Proof Transactions: A user cannot create a transaction claiming to be paid by someone else unless they have explicit Editor rights within that shared ledger.

Pillar 3: Presentational Purity and Layer Isolation

⚬ Pure UI Components: Components in components/features/* must ONLY receive financial data and authorization states via props. They must NOT directly query Firestore or calculate split results internally.
⚬ Server/Client Boundary: Default to React Server Components. Only declare 'use client' at the top of the file when React Hooks (useState, useEffect) or browser event listeners are required. Data fetching should primarily occur on the server side.

4. Firebase Architecture and Strict SDK Isolation

⚬ Client SDK (lib/firebase/client.ts):
  ⚬ Packages used: firebase/app, firebase/auth, firebase/firestore.
  ⚬ Scope: Client Components, custom browser Hooks (e.g., useAuth).
⚬ Admin SDK (lib/firebase/server.ts):
  ⚬ Packages used: firebase-admin.
  ⚬ Scope: Server Actions (app/actions/*), Route Handlers (app/api/*).
  ⚬ Security Red Line: It is strictly prohibited to import lib/firebase/server.ts into Client Components or any public module. This is to prevent server private key leakage.
⚬ Data Conversion and Strong Typing:
  ⚬ All collection operations MUST use withConverter<T>() to ensure type safety.
  ⚬ Collection reads, writes, and queries must be encapsulated under lib/[feature_name]/.

5. UI and Design System Guidelines

⚬ Design Tokens: Colors, spacing, and border radius must use CSS variables defined in globals.css (e.g., bg-background, text-foreground, border-border).
⚬ Class Merging: All conditional class merging must use the cn() utility function from @/lib/utils.
⚬ Adding Components: Prioritize using existing components from @/components/ui/*. If a new base component is required, uniformly execute npx shadcn@latest add <component-name> via the terminal.

6. Testing and Acceptance Criteria

All Pull Requests must pass the following validations before merging:

1. Unit Testing (Vitest):
  ⚬ Command: npm run test:unit
  ⚬ Scope: CRITICAL: 100% test coverage is required for lib/finance/ (Bill splitting algorithms, exact division remainder handling, integer math functions).
2. Security Rules Validation:
  ⚬ Command: npm run test:rules
  ⚬ Scope: Use @firebase/rules-unit-testing to validate Firestore Rules. Must prove that unauthorized users cannot read or modify other groups' ledgers.
3. End-to-End Testing (Playwright):
  ⚬ Command: npx playwright test
  ⚬ Scope: Core user journeys (authentication, creating a ledger, adding a transaction, viewing split settlements).

7. Localization and Traditional Chinese (Taiwan) Terminology Guidelines

All user-facing text in the project (buttons, prompts, form validations, dialog messages, Toast notifications) MUST strictly use Traditional Chinese (Taiwan colloquialisms). Transliterations from Simplified Chinese or the use of Mainland Chinese terminology is strictly prohibited.

Terminology Mapping Table:

Taiwan Customary Terms (MUST USE)	Prohibited Terms (AVOID)
使用者 / 會員 (User / Member)	用戶
登入 / 登出 (Log in / Log out)	登錄 / 退出
設定 (Settings)	設置
專案 (Project)	項目
預設 (Default)	默認
支援 (Support)	支持
資訊 (Information)	信息
上傳 / 下載 (Upload / Download)	上載 / 下載
連結 (Link)	鏈接
建立 (Create)	創建
確認 / 送出 (Confirm / Submit)	提交 / 確定
帳本 / 記帳 (Ledger / Accounting)	賬本 / 記賬
結算 / 分帳 (Settlement / Bill Split)	結賬 / 平攤