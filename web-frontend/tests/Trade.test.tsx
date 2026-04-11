import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

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
    ],
  }),
  getCarbonCreditById: vi.fn().mockResolvedValue({
    success: true,
    data: {
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
  }),
  createOrder: vi.fn().mockResolvedValue({ success: true }),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn().mockResolvedValue({
    data: { id: "1", email: "test@example.com", name: "Test User" },
  }),
}));

vi.mock("../src/contexts/AuthContext", async () => {
  const actual = await vi.importActual<
    typeof import("../src/contexts/AuthContext")
  >("../src/contexts/AuthContext");
  return {
    ...actual,
    useAuth: () => ({
      isAuthenticated: true,
      user: { id: "1", name: "Test User", email: "test@example.com" },
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    }),
  };
});

// Import Trade AFTER mocks are set up
import Trade from "../src/pages/Trade";

const renderTrade = () =>
  render(
    <BrowserRouter>
      <Trade />
    </BrowserRouter>,
  );

describe("Trade Page", () => {
  it("renders trade page title", async () => {
    renderTrade();
    await waitFor(() => {
      expect(screen.getByText(/Trade Carbon Credits/i)).toBeInTheDocument();
    });
  });

  it("renders credit information section", async () => {
    renderTrade();
    await waitFor(() => {
      expect(screen.getByText("Credit Information")).toBeInTheDocument();
    });
  });

  it("renders order form", async () => {
    renderTrade();
    await waitFor(() => {
      expect(screen.getByText("Place Order")).toBeInTheDocument();
    });
  });

  it("shows buy and sell radio options", async () => {
    renderTrade();
    await waitFor(() => {
      expect(screen.getByLabelText(/^buy$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^sell$/i)).toBeInTheDocument();
    });
  });

  it("shows quantity input", async () => {
    renderTrade();
    await waitFor(() => {
      expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for zero quantity", async () => {
    const { container } = renderTrade();
    await waitFor(() =>
      expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument(),
    );

    // Submit the form directly — quantity is empty, so validation should fire
    const form = container.querySelector("form");
    expect(form).toBeTruthy();

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a valid quantity"),
      ).toBeInTheDocument();
    });
  });

  it("calculates total cost correctly", async () => {
    renderTrade();
    await waitFor(() =>
      expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument(),
    );

    await userEvent.type(screen.getByLabelText(/quantity/i), "10");

    await waitFor(() => {
      expect(screen.getByText("$285.00")).toBeInTheDocument();
    });
  });
});
