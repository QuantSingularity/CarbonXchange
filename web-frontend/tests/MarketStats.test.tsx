import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarketStats from "../src/components/MarketStats";

vi.mock("../src/services/api", () => ({
  getMarketStats: vi.fn(),
  getMockMarketStats: vi.fn().mockReturnValue({
    success: true,
    data: {
      averagePrice: 27.45,
      priceChange24h: 1.23,
      volume24h: 18500,
      totalVolume: 1260000,
      lastUpdated: new Date().toISOString(),
    },
  }),
  isUsingMockData: vi.fn().mockReturnValue(true),
  subscribeToMarketData: vi.fn().mockReturnValue(() => {}),
}));

describe("MarketStats Component", () => {
  it("renders three stat cards", async () => {
    render(<MarketStats />);
    await waitFor(() => {
      expect(screen.getByText("Average Price")).toBeInTheDocument();
      expect(screen.getByText("24h Change")).toBeInTheDocument();
      expect(screen.getByText("24h Volume")).toBeInTheDocument();
    });
  });

  it("displays average price", async () => {
    render(<MarketStats />);
    await waitFor(() => {
      expect(screen.getByText("$27.45")).toBeInTheDocument();
    });
  });

  it("displays 24h change with percentage", async () => {
    render(<MarketStats />);
    await waitFor(() => {
      expect(screen.getByText("1.23%")).toBeInTheDocument();
    });
  });

  it("displays volume with tCO2e unit", async () => {
    render(<MarketStats />);
    await waitFor(() => {
      expect(screen.getByText(/tCO2e/)).toBeInTheDocument();
    });
  });
});
