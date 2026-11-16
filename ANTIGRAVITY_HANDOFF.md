# Antigravity 接手說明

請先閱讀本文件，再閱讀 `README.md`、`ARCHITECTURE.md`、`user_story.md`、
`copilot-instructions.md` 與 Firebase 設定。這份文件記錄目前已完成的雲端設定，
並說明接下來實作時需要遵守的限制。

## 專案目標

這是以繁體中文（台灣）為主的小組記帳與分帳 App。使用者故事涵蓋帳號、
共用帳本、邀請、支出、分攤、結算、還款、群組管理與統計，詳見 `user_story.md`。
預期技術架構是 Next.js App Router、TypeScript strict mode、Tailwind CSS、
shadcn/ui 與 Firebase；完整規範以 `ARCHITECTURE.md` 為準。

## 目前狀態

- 專案目前以需求與架構文件為主；接手時先檢查實際檔案與 Git 狀態，不要假設
  App、套件或測試已建立。
- Firebase 專案已建立並加入 Firebase：
  - 顯示名稱：`AI language model intergrition`
  - Project ID：`ai-language-model-intergrition`
  - Project Number：`480766533329`
- `.firebaserc` 已將此 Firebase 專案設為本機 CLI 預設專案。
- Cloud Firestore Standard 預設資料庫已建立於台灣 `asia-east1`。
- Firebase Authentication 已啟用 Google 登入。OAuth 支援信箱設定為
  `pokemc32@gmail.com`。
- Firebase 部署時曾自動建立 Default Web App；尚未確認前端 SDK 設定已下載或
  接入程式碼。
- Firestore 規則目前是**拒絕所有讀寫**的安全預設值；尚未按帳本成員與角色
  實作授權規則。因此目前 App 不應期待能讀寫 Firestore。
- `firestore.indexes.json` 目前沒有額外索引。
- 專案的 Firebase 預設資源地區顯示為未指定；Firestore 資料庫本身已在台灣。
  Firebase Authentication 沒有在此設定中指定台灣資料地區。不要聲稱所有 Firebase
  資料或服務均只儲存在台灣。

## Firebase 設定檔

- `firebase.json`：Firestore 使用 `(default)` 資料庫、`asia-east1`；Google Sign-In
  設定與本機開發 redirect URI。
- `.firebaserc`：指向 `ai-language-model-intergrition`。
- `firestore.rules`：目前全封鎖，尚待依資料模型實作最小權限規則。
- `firestore.indexes.json`：空索引設定。

不要把 Firebase Admin 私密金鑰、OAuth client secret 或其他憑證寫進 repo。
如需 Firebase Web SDK 設定，使用 Firebase CLI 取得並依架構放置；公開 Web config
不是 Admin 私鑰，但仍須遵守 repo 的設定與環境變數慣例。

## 接手工作順序

1. 檢查 repo 檔案、Git 狀態、現有依賴與 Firebase 登入／專案連結；保留所有既有
   使用者變更，不要重設或覆寫未提交內容。
2. 依 `ARCHITECTURE.md` 與 `user_story.md` 建立可執行的 Next.js / TypeScript 專案
   骨架；如文件規範和現有程式碼不同，先確認實際狀態並採用一致方案。
3. 先定義帳本、成員角色、支出、分攤與結算資料模型，再實作 Firebase client/server
   初始化及有型別的資料存取層。Server-only Admin SDK 不可被 Client Component 匯入。
4. 所有金額以整數最小單位儲存與計算，禁止用浮點數做金額運算；平均分攤必須明確
   分配除不盡的餘額，並測試分攤總和等於原始金額。
5. 根據已定義的資料模型撰寫 Firestore Security Rules：至少驗證登入身分、
   帳本成員資格、角色權限與付款人不可偽造。以 Emulator 規則測試驗證拒絕案例。
   在規則與測試準備完成前，保留目前的封鎖規則，不要部署寬鬆的暫時規則。
6. 依序實作登入、帳本與支出等核心流程，增加必要索引與單元／規則／E2E 測試；
   執行 `ARCHITECTURE.md` 指定的驗證命令，並回報尚未完成或環境阻礙。
7. 所有面向使用者的文字使用繁體中文（台灣）用語，並遵守 `copilot-instructions.md`。

## Firebase CLI

在已登入 Firebase CLI 的環境中，於 repo 根目錄執行：

```bash
npx -y firebase-tools@latest login:list
npx -y firebase-tools@latest use
npx -y firebase-tools@latest firestore:databases:list
```

使用者帳戶登入狀態可能不同；如果 CLI 未登入，請先完成 Firebase CLI 登入，
不要要求使用者提供密碼或貼上私人憑證。執行部署前確認目前專案為
`ai-language-model-intergrition`，並先驗證規則與索引。
