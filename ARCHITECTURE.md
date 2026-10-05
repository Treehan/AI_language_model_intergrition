# 專案架構與技術說明 (System Architecture)

## 1. 技術堆疊 (Tech Stack)

### 前端 (Frontend)
*   **核心框架**: Next.js (App Router)
*   **程式語言**: TypeScript
*   **UI 框架 / 樣式**: Tailwind CSS, shadcn/ui, Lucide Icons
*   **狀態管理**: React Context / Zustand (視專案需求引入)

### 後端與資料庫 (Backend & Database - Firebase)
*   **資料庫**: Firebase Firestore (NoSQL)
*   **身分驗證**: Firebase Authentication
*   **儲存空間**: Firebase Cloud Storage
*   **無伺服器函式**: Firebase Cloud Functions (視需求處理複雜後端邏輯)

### 部署與版本控制 (Deployment & CI/CD)
*   **版本控制**: Git / GitHub
*   **主機代管**: Vercel 或 Firebase Hosting
*   **AI 輔助開發**: GitHub Copilot

---

## 2. 目錄結構 (Directory Structure)

專案採用 Next.js App Router 的標準結構，並整合 Firebase 的設定檔，請依照以下規範放置專案檔案：

```text
├── src/
│   ├── app/                # Next.js 路由與頁面 (App Router)
│   │   ├── (auth)/         # 身分驗證相關的路由群組 (如登入、註冊頁面)
│   │   ├── api/            # Next.js 內部 API 路由 (如有需要)
│   │   ├── layout.tsx      # 全域佈局
│   │   └── page.tsx        # 首頁
│   ├── components/         # 跨頁面共用的 React 組件
│   │   ├── ui/             # 由 shadcn/ui 生成的基礎組件 (請勿直接修改核心邏輯)
│   │   └── shared/         # 專案客製化的共用組件
│   ├── lib/                # 共用函式庫與設定檔
│   │   ├── firebase/       # Firebase 初始化與設定檔 (firebase.ts, admin.ts)
│   │   └── utils.ts        # shadcn/ui 預設的工具函式
│   ├── types/              # TypeScript 的全域型別定義檔
│   └── styles/             # 全域樣式設定 (如 globals.css)
├── public/                 # 靜態資源 (圖片、網站圖示等)
├── .github/
│   └── copilot-instructions.md # 提供給 GitHub Copilot 的精簡開發守則
├── ARCHITECTURE.md         # 專案架構與規範說明 (本檔案)
├── tailwind.config.ts      # Tailwind CSS 相關設定檔
├── components.json         # shadcn/ui 的設定檔
└── package.json            # 專案依賴套件與腳本
