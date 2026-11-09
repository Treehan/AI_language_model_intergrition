import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "../../src/app/page";

describe("首頁", () => {
  it("顯示應用程式名稱及尚未實作產品流程的提示", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "小組記帳與分帳 App" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("目前僅提供可執行的測試基礎，產品流程尚未實作。"),
    ).toBeInTheDocument();
  });
});
