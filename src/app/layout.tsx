import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "小組記帳與分帳 App",
  description: "小組共同記帳與分帳應用程式的測試基礎。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
