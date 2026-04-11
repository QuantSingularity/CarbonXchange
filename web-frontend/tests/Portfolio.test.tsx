import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Portfolio from "../src/pages/Portfolio";

vi.mock("../src/services/api", () => ({
  getPortfolio: vi.fn().mockResolvedValue({
    success: true,
    data: {
      totalValue: 4480.0,
      totalCredits: 150,
      holdings: [
        {
          creditId: "1",
          name: "Amazon Rainforest Conservation",
          quantity: 100,
          averagePrice: 28.5,
          currentPrice: 28.8,
          value: 2880.0,
          profitLoss: 30.0,
          profitLossPercent: 1.05,
        },
      ],
    },
  }),
  getMyOrders: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: "1",
        creditId: "1",
        creditName: "Amazon Rainforest Conservation",
        orderType: "buy",
        quantity: 100,
        price: 28.5,
        status: "completed",
        createdAt: new Date().toISOString(),
      },
    ],
  }),
}));

const renderPortfolio = () =>
  render(
    <BrowserRouter>
      <Portfolio />
    </BrowserRouter>,
  );

describe("Portfolio Page", () => {
  it("renders portfolio title", async () => {
    renderPortfolio();
    await waitFor(() => {
      expect(screen.getByText("Portfolio")).toBeInTheDocument();
    });
  });

  it("renders total value stat card", async () => {
    renderPortfolio();
    await waitFor(() => {
      // getAllByText since "Total Value" appears in both card header and holdings
      expect(screen.getAllByText("Total Value").length).toBeGreaterThan(0);
      expect(screen.getByText("$4480.00")).toBeInTheDocument();
    });
  });

  it("renders total credits stat card", async () => {
    renderPortfolio();
    await waitFor(() => {
      expect(screen.getByText("Total Credits")).toBeInTheDocument();
      expect(screen.getByText("150")).toBeInTheDocument();
    });
  });

  it("renders holdings tab content", async () => {
    renderPortfolio();
    await waitFor(() => {
      expect(
        screen.getByText("Amazon Rainforest Conservation"),
      ).toBeInTheDocument();
    });
  });

  it("renders tab navigation", async () => {
    renderPortfolio();
    await waitFor(() => {
      expect(screen.getByText("Holdings")).toBeInTheDocument();
      expect(screen.getByText("Orders")).toBeInTheDocument();
    });
  });

  it("shows profit/loss badge on holdings", async () => {
    renderPortfolio();
    await waitFor(() => {
      expect(screen.getByText("+$30.00")).toBeInTheDocument();
    });
  });
});
