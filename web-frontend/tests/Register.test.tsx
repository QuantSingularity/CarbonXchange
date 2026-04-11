import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../src/contexts/AuthContext";
import Register from "../src/pages/Register";

vi.mock("../src/services/api", () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

const renderRegister = () =>
  render(
    <BrowserRouter>
      <AuthProvider>
        <Register />
      </AuthProvider>
    </BrowserRouter>,
  );

describe("Register Page", () => {
  it("renders registration form fields", () => {
    renderRegister();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(document.getElementById("password")).toBeInTheDocument();
    expect(document.getElementById("confirmPassword")).toBeInTheDocument();
  });

  it("renders create account button", () => {
    renderRegister();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
  });

  it("shows branding", () => {
    renderRegister();
    expect(screen.getByText(/create an account/i)).toBeInTheDocument();
    expect(screen.getByText("CarbonXchange")).toBeInTheDocument();
  });

  it("has a link to sign in page", () => {
    renderRegister();
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it("shows error when passwords do not match", async () => {
    renderRegister();
    await userEvent.type(screen.getByLabelText(/full name/i), "Test User");
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(document.getElementById("password")!, "password123");
    await userEvent.type(
      document.getElementById("confirmPassword")!,
      "differentpassword",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /create account/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it("shows error when password is too short", async () => {
    renderRegister();
    await userEvent.type(screen.getByLabelText(/full name/i), "Test User");
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(document.getElementById("password")!, "abc");
    await userEvent.type(document.getElementById("confirmPassword")!, "abc");
    await userEvent.click(
      screen.getByRole("button", { name: /create account/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    });
  });

  it("all fields are required", () => {
    renderRegister();
    const nameInput = screen.getByLabelText(/full name/i) as HTMLInputElement;
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(nameInput.required).toBe(true);
    expect(emailInput.required).toBe(true);
  });
});
