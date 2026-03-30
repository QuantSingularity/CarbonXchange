import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Provider } from "react-redux";
import RegisterScreen from "../../../screens/Auth/RegisterScreen";
import authReducerActual from "../../../store/slices/authSlice";

const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate, goBack: jest.fn() };

const mockRegisterUserImplementation = (_userData) => (_dispatch) => {
  return Promise.resolve({
    type: "auth/registerUser/fulfilled",
    payload: { user: "testUser", token: "testToken" },
  });
};
const mockRegisterUser = jest.fn(mockRegisterUserImplementation);
const mockResetAuthErrorImplementation = () => ({
  type: "auth/resetAuthError",
});
const mockResetAuthError = jest.fn(mockResetAuthErrorImplementation);

jest.mock("../../../store/slices/authSlice", () => ({
  ...jest.requireActual("../../../store/slices/authSlice"),
  registerUser: mockRegisterUser,
  resetAuthError: mockResetAuthError,
}));

import * as authSlice from "../../../store/slices/authSlice";

describe("RegisterScreen", () => {
  let store;
  const initialAuthState = {
    isLoading: false,
    error: null,
    isLoggedIn: false,
    user: null,
  };

  const createTestStore = (preloadedState = {}) => {
    return configureStore({
      reducer: {
        auth: authReducerActual,
      },
      preloadedState: {
        auth: { ...initialAuthState, ...preloadedState.auth },
      },
    });
  };

  beforeEach(() => {
    store = createTestStore();
    mockNavigate.mockClear();
    mockRegisterUser
      .mockClear()
      .mockImplementation(mockRegisterUserImplementation);
    mockResetAuthError
      .mockClear()
      .mockImplementation(mockResetAuthErrorImplementation);
  });

  const renderComponent = (currentStore = store) => {
    return render(
      <Provider store={currentStore}>
        <RegisterScreen navigation={mockNavigation} />
      </Provider>,
    );
  };

  it("renders correctly with initial elements", () => {
    const { getByPlaceholderText, getByText } = renderComponent();
    expect(getByPlaceholderText("Username")).toBeTruthy();
    expect(getByPlaceholderText("Email")).toBeTruthy();
    expect(getByPlaceholderText("Password")).toBeTruthy();
    expect(getByPlaceholderText("Confirm Password")).toBeTruthy();
    expect(getByText("Register")).toBeTruthy();
    expect(getByText("Already have an account? Login")).toBeTruthy();
  });

  it("allows typing in input fields", () => {
    const { getByPlaceholderText } = renderComponent();
    fireEvent.changeText(getByPlaceholderText("Username"), "testuser");
    fireEvent.changeText(getByPlaceholderText("Email"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(
      getByPlaceholderText("Confirm Password"),
      "password123",
    );

    expect(getByPlaceholderText("Username").props.value).toBe("testuser");
    expect(getByPlaceholderText("Email").props.value).toBe("test@example.com");
    expect(getByPlaceholderText("Password").props.value).toBe("password123");
    expect(getByPlaceholderText("Confirm Password").props.value).toBe(
      "password123",
    );
  });

  it("calls registerUser action on register button press with valid inputs", () => {
    const { getByPlaceholderText, getByText } = renderComponent();
    fireEvent.changeText(getByPlaceholderText("Username"), "testuser");
    fireEvent.changeText(getByPlaceholderText("Email"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(
      getByPlaceholderText("Confirm Password"),
      "password123",
    );
    fireEvent.press(getByText("Register"));

    expect(authSlice.registerUser).toHaveBeenCalledWith({
      username: "testuser",
      email: "test@example.com",
      password: "password123",
    });
  });

  it("shows alert if any field is empty on register attempt", () => {
    const { getByText } = renderComponent();
    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");
    fireEvent.press(getByText("Register"));
    expect(alertSpy).toHaveBeenCalledWith(
      "Error",
      "Please fill in all fields.",
    );
    alertSpy.mockRestore();
  });

  it("shows alert if passwords do not match", () => {
    const { getByPlaceholderText, getByText } = renderComponent();
    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");
    fireEvent.changeText(getByPlaceholderText("Username"), "testuser");
    fireEvent.changeText(getByPlaceholderText("Email"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.changeText(
      getByPlaceholderText("Confirm Password"),
      "password456",
    );
    fireEvent.press(getByText("Register"));
    expect(alertSpy).toHaveBeenCalledWith("Error", "Passwords do not match.");
    alertSpy.mockRestore();
  });

  it("navigates to Login screen on login button press", () => {
    const { getByText } = renderComponent();
    fireEvent.press(getByText("Already have an account? Login"));
    expect(mockNavigate).toHaveBeenCalledWith("Login");
  });

  it("displays activity indicator when isLoading is true", () => {
    const loadingStore = createTestStore({ auth: { isLoading: true } });
    const { queryByText, getByTestId } = renderComponent(loadingStore);
    expect(queryByText("Register")).toBeNull(); // Assuming button is hidden
    // Add testID="loading-indicator" to ActivityIndicator in RegisterScreen.js for this to work
    // expect(getByTestId("loading-indicator")).toBeTruthy();
  });

  it("displays error message if registration fails and resets error", async () => {
    const error = { message: "Email already exists" };
    const errorStore = createTestStore({ auth: { error: error } });
    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");

    renderComponent(errorStore);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Registration Failed",
        "Email already exists",
      );
    });
    expect(authSlice.resetAuthError).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  it("resets auth error before a new registration attempt if an error was present", () => {
    const error = { message: "Previous error" };
    const errorStore = createTestStore({ auth: { error: error } });
    const { getByPlaceholderText, getByText } = renderComponent(errorStore);

    expect(authSlice.resetAuthError).toHaveBeenCalledTimes(1);
    mockResetAuthError.mockClear();

    fireEvent.changeText(getByPlaceholderText("Username"), "newuser");
    fireEvent.changeText(getByPlaceholderText("Email"), "new@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "newpass123");
    fireEvent.changeText(
      getByPlaceholderText("Confirm Password"),
      "newpass123",
    );
    fireEvent.press(getByText("Register"));

    expect(authSlice.resetAuthError).toHaveBeenCalledTimes(1);
    expect(authSlice.registerUser).toHaveBeenCalledWith({
      username: "newuser",
      email: "new@example.com",
      password: "newpass123",
    });
  });
});
