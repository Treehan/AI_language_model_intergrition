import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "../../src/app/page";

describe("小組記帳與分帳 App - 整合單元測試 (User Stories 1–10)", () => {
  it("顯示應用程式名稱、預設帳本標題、新增支出並支援切換至結算與統計頁面", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "小組記帳與分帳 App" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("active-ledger-title")).toHaveTextContent(
      "花蓮三天兩夜旅遊帳本",
    );

    // 測試新增一筆 1000 元平均分攤支出 (User Story 4 & 5)
    fireEvent.change(screen.getByLabelText("項目名稱"), {
      target: { value: "溫泉飯店住宿" },
    });
    fireEvent.change(screen.getByLabelText(/金額/), {
      target: { value: "1000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));

    expect(screen.getByText("溫泉飯店住宿")).toBeInTheDocument();

    // 切換到「結算」頁籤 (User Story 6)
    fireEvent.click(screen.getByRole("button", { name: "結算" }));
    expect(screen.getByText("建議還款方式（最少轉帳次數）")).toBeInTheDocument();

    // 切換到「統計」頁籤 (User Story 10)
    fireEvent.click(screen.getByRole("button", { name: "統計" }));
    expect(screen.getByTestId("expense-pie-chart")).toBeInTheDocument();
  });
});
