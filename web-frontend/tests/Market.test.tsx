import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Market from "../src/pages/Market";

vi.mock("../src/services/api", () => ({
  getCarbonCredits: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: "1",
        name: "Amazon Rainforest Conservation",
        type: "Forestry",
        price: 28.5,
        available: 5000,
        totalIssued: 10000,
        vintage: 2024,
        verificationStandard: "VCS",
        location: "Brazil",
        description: "Conservation project protecting Amazon rainforest",
      },
      {
        id: "2",
        name: "Wind Farm Project",
        type: "Renewable Energy",
        price: 24.2,
        available: 8000,
        totalIssued: 15000,
        vintage: 2024,
        verificationStandard: "Gold Standard",
        location: "India",
        description: "150MW wind farm generating clean energy",
      },
    ],
  }),
}));

const renderMarket = () =>
  render(
    <BrowserRouter>
      <Market />
    </BrowserRouter>,
  );

describe("Market Page", () => {
  it("renders page title", async () => {
    renderMarket();
    await waitFor(() => {
      expect(screen.getByText(/Carbon Credit Market/i)).toBeInTheDocument();
    });
  });

  it("renders credit cards after loading", async () => {
    renderMarket();
    await waitFor(() => {
      expect(
        screen.getByText("Amazon Rainforest Conservation"),
      ).toBeInTheDocument();
      expect(screen.getByText("Wind Farm Project")).toBeInTheDocument();
    });
  });

  it("filters credits by search term", async () => {
    renderMarket();
    await waitFor(() =>
      expect(
        screen.getByText("Amazon Rainforest Conservation"),
      ).toBeInTheDocument(),
    );

    const searchInput = screen.getByPlaceholderText(/search credits/i);
    await userEvent.type(searchInput, "Wind");

    expect(
      screen.queryByText("Amazon Rainforest Conservation"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Wind Farm Project")).toBeInTheDocument();
  });

  it("shows empty state when no search results", async () => {
    renderMarket();
    await waitFor(() =>
      expect(
        screen.getByText("Amazon Rainforest Conservation"),
      ).toBeInTheDocument(),
    );

    const searchInput = screen.getByPlaceholderText(/search credits/i);
    await userEvent.type(searchInput, "nonexistent credit xyz");

    expect(screen.getByText(/No carbon credits found/i)).toBeInTheDocument();
  });

  it("displays formatted price info", async () => {
    renderMarket();
    await waitFor(() => {
      // Price is formatted with toFixed(2) so it shows $28.50
      expect(screen.getByText("$28.50")).toBeInTheDocument();
    });
  });

  it("renders trade buttons for each credit", async () => {
    renderMarket();
    await waitFor(() => {
      const tradeButtons = screen.getAllByRole("button", { name: /trade/i });
      expect(tradeButtons.length).toBe(2);
    });
  });
});
