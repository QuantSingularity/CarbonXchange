import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../src/contexts/AuthContext";
import Login from "../src/pages/Login";

vi.mock("../src/services/api", () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

const renderLogin = () =>
  render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>,
  );

describe("Login Page", () => {
  it("renders login form", () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("renders password input", () => {
    renderLogin();
    // Use the input id directly since getByLabelText can conflict with show-password button
    const passwordInput = document.getElementById(
      "password",
    ) as HTMLInputElement;
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput.type).toBe("password");
  });

  it("displays CarbonXchange branding", () => {
    renderLogin();
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByText("CarbonXchange")).toBeInTheDocument();
  });

  it("has a link to register page", () => {
    renderLogin();
    expect(screen.getByText(/create account/i)).toBeInTheDocument();
  });

  it("validates required fields", () => {
    renderLogin();
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    const passwordInput = document.getElementById(
      "password",
    ) as HTMLInputElement;
    expect(emailInput.required).toBe(true);
    expect(passwordInput.required).toBe(true);
  });
});
