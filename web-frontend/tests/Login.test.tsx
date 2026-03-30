import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../src/contexts/AuthContext";
import Login from "../src/pages/Login";

// Mock the API
vi.mock("../src/services/api", () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

describe("Login Page", () => {
  const renderLogin = () => {
    return render(
      <BrowserRouter>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </BrowserRouter>,
    );
  };

  it("renders login form", () => {
    renderLogin();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("displays CarbonXchange branding", () => {
    renderLogin();

    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByText(/CX/)).toBeInTheDocument();
  });

  it("has a link to register page", () => {
    renderLogin();

    expect(screen.getByText(/register/i)).toBeInTheDocument();
  });

  it("validates required fields", async () => {
    renderLogin();

    // Form should have HTML5 validation
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(
      /password/i,
    ) as HTMLInputElement;

    expect(emailInput.required).toBe(true);
    expect(passwordInput.required).toBe(true);
  });
});
