import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Dashboard from "../src/components/Dashboard";

// Mock the charts
vi.mock("../src/components/charts/CarbonPriceChart", () => ({
  default: () => <div data-testid="price-chart">Price Chart</div>,
}));

vi.mock("../src/components/charts/TradingVolumeChart", () => ({
  default: () => <div data-testid="volume-chart">Volume Chart</div>,
}));

vi.mock("../src/components/MarketStats", () => ({
  default: () => <div data-testid="market-stats">Market Stats</div>,
}));

describe("Dashboard Component", () => {
  it("renders dashboard title", () => {
    render(<Dashboard />);
    expect(screen.getByText(/CarbonXchange Dashboard/i)).toBeInTheDocument();
  });

  it("renders market stats", () => {
    render(<Dashboard />);
    expect(screen.getByTestId("market-stats")).toBeInTheDocument();
  });

  it("renders chart tabs", () => {
    render(<Dashboard />);
    expect(screen.getAllByText(/Carbon Credit Price/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(/Trading Volume/i)).toBeInTheDocument();
  });

  it("displays price chart by default", () => {
    render(<Dashboard />);
    expect(screen.getByTestId("price-chart")).toBeInTheDocument();
  });
});
