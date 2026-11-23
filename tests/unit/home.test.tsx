import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Home from "../../src/app/page";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("小組記帳與分帳 App - 整合單元測試 (User Stories 1–10)", () => {
  it("顯示應用程式名稱、預設帳本標題、新增支出並支援切換至結算與統計頁面", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "小組記帳與分帳 App" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("active-ledger-title")).toHaveTextContent(
      "花蓮三天兩夜旅遊帳本",
    );
    const navigation = screen.getByRole("navigation", {
      name: "主要功能導覽",
    });
    expect(navigation).toHaveTextContent("帳本總覽");
    expect(navigation).toHaveTextContent("支出帳目");
    expect(navigation).toHaveTextContent("結算還款");
    expect(navigation).toHaveTextContent("支出統計");
    expect(navigation).toHaveTextContent("群組與成員");

    const navigationToggle = screen.getByTestId("workspace-navigation-toggle");
    expect(navigationToggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(navigationToggle);
    expect(navigationToggle).toHaveAttribute("aria-expanded", "false");
    expect(
      within(navigation).getByRole("button", { name: /^支出帳目$/ }),
    ).toBeInTheDocument();
    fireEvent.click(navigationToggle);

    // 測試新增一筆 1000 元平均分攤支出 (User Story 4 & 5)
    fireEvent.click(
      within(navigation).getByRole("button", { name: /^支出帳目$/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "新增支出" }));
    fireEvent.change(screen.getByLabelText("項目名稱"), {
      target: { value: "溫泉飯店住宿" },
    });
    fireEvent.change(screen.getByLabelText(/金額/), {
      target: { value: "1000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));

    expect(screen.getByText("溫泉飯店住宿")).toBeInTheDocument();

    // 切換到「結算」頁籤 (User Story 6)
    fireEvent.click(
      within(navigation).getByRole("button", { name: /^結算還款$/ }),
    );
    expect(screen.getByText("建議還款方式（最少轉帳次數）")).toBeInTheDocument();

    // 切換到「統計」頁籤 (User Story 10)
    fireEvent.click(
      within(navigation).getByRole("button", { name: /^支出統計$/ }),
    );
    expect(screen.getByTestId("expense-pie-chart")).toBeInTheDocument();
  });

  it("手機導覽可收合群組功能，並清楚標示本機資料狀態", () => {
    render(<Home />);

    expect(
      screen.getByText("資料僅儲存在此裝置，尚未跨裝置同步"),
    ).toBeInTheDocument();
    const mobileNavigation = screen.getByRole("navigation", {
      name: "手機主要導覽",
    });
    fireEvent.click(within(mobileNavigation).getByRole("button", { name: "更多" }));
    fireEvent.click(
      screen.getByRole("button", { name: "開啟群組與成員" }),
    );
    expect(screen.getByText("邀請連結或邀請碼")).toBeInTheDocument();
  });
});
