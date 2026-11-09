# 小組記帳與分帳 App

目前提供 Next.js、TypeScript 與測試工具的可執行基礎；產品流程尚未實作。

## 開發

```bash
npm ci
npm run dev
```

## 測試

第一次執行端對端測試前，先安裝 Playwright 的 Chromium：

```bash
npx playwright install chromium
```

接著可分別執行單元測試與端對端 smoke test，或一次執行兩者：

```bash
npm run test:unit
npm run test:e2e
npm test
```

端對端測試會自動啟動 Next.js 開發伺服器，確認首頁可載入並呈現應用程式標題。單元測試目前確認首頁元件可正常渲染；尚未加入 Firebase 或產品流程測試。