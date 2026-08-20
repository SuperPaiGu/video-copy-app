import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders upload input and empty task state", () => {
    render(<HomePage />);

    expect(screen.getByText("选择视频")).toBeInTheDocument();
    expect(screen.getByText("任务列表")).toBeInTheDocument();
    expect(screen.getByText("暂无任务，请先上传视频。")).toBeInTheDocument();
  });
});
