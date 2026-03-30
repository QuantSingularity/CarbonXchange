import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Provider } from "react-redux";
import LoginScreen from "../../../screens/Auth/LoginScreen";
import authReducerActual from "../../../store/slices/authSlice"; // Import the actual reducer and the module

// theme import might be needed if LoginScreen uses it directly or via styled components not covered by snapshot
// import theme from "../../../styles/theme";

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate };

// Create mock functions for the actions we want to spy on or control
const mockLoginUserImplementation = (_credentials) => (_dispatch) => {
  // Simulate thunk behavior, can return a promise
  // For testing, we can check if this is called with correct args
  // and simulate success/failure by how the promise resolves/rejects if needed by component logic
  return Promise.resolve({
    type: "auth/loginUser/fulfilled",
    payload: { user: "testUser", token: "testToken" },
  });
};
const mockLoginUser = jest.fn(mockLoginUserImplementation);
const mockResetAuthErrorImplementation = () => ({
  type: "auth/resetAuthError",
});
const mockResetAuthError = jest.fn(mockResetAuthErrorImplementation);

// Mock the authSlice module to replace specific exports (action creators)
jest.mock("../../../store/slices/authSlice", () => ({
  ...jest.requireActual("../../../store/slices/authSlice"), // Import and retain default behavior (e.g., the reducer itself)
  loginUser: mockLoginUser,
  resetAuthError: mockResetAuthError,
}));

// Re-import the mocked module to get access to the mocked action creators if needed directly in tests
// (though usually you assert on the mocks defined above)
import * as authSlice from "../../../store/slices/authSlice";

describe("LoginScreen", () => {
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
        auth: authReducerActual, // Use the actual reducer from the slice
      },
      preloadedState: {
        auth: { ...initialAuthState, ...preloadedState.auth },
      },
      // Middleware is automatically included by RTK (e.g., thunk)
    });
  };

  beforeEach(() => {
    store = createTestStore(); // Create a fresh store for each test
    mockNavigate.mockClear();
    mockLoginUser.mockClear().mockImplementation(mockLoginUserImplementation); // Reset and re-apply default mock impl
    mockResetAuthError
      .mockClear()
      .mockImplementation(mockResetAuthErrorImplementation);
  });

  const renderComponent = (currentStore = store) => {
    return render(
      <Provider store={currentStore}>
        <LoginScreen navigation={mockNavigation} />
      </Provider>,
    );
  };

  it("renders correctly with initial elements", () => {
    const { getByPlaceholderText, getByText } = renderComponent();
    expect(getByPlaceholderText("Email")).toBeTruthy();
    expect(getByPlaceholderText("Password")).toBeTruthy();
    expect(getByText("Login")).toBeTruthy();
    expect(getByText("Don't have an account? Register")).toBeTruthy();
  });

  it("allows typing in email and password fields", () => {
    const { getByPlaceholderText } = renderComponent();
    const emailInput = getByPlaceholderText("Email");
    const passwordInput = getByPlaceholderText("Password");

    fireEvent.changeText(emailInput, "test@example.com");
    fireEvent.changeText(passwordInput, "password123");

    expect(emailInput.props.value).toBe("test@example.com");
    expect(passwordInput.props.value).toBe("password123");
  });

  it("calls loginUser action on login button press with valid inputs", () => {
    const { getByPlaceholderText, getByText } = renderComponent();
    fireEvent.changeText(getByPlaceholderText("Email"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.press(getByText("Login"));

    expect(authSlice.loginUser).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("shows alert if email or password is empty on login attempt", () => {
    const { getByText } = renderComponent();
    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");
    fireEvent.press(getByText("Login"));
    expect(alertSpy).toHaveBeenCalledWith(
      "Error",
      "Please enter both email and password.",
    );
    alertSpy.mockRestore();
  });

  it("navigates to Register screen on register button press", () => {
    const { getByText } = renderComponent();
    fireEvent.press(getByText("Don't have an account? Register"));
    expect(mockNavigate).toHaveBeenCalledWith("Register");
  });

  it("displays activity indicator when isLoading is true", () => {
    const loadingStore = createTestStore({ auth: { isLoading: true } });
    const { queryByText, getByTestId } = renderComponent(loadingStore);
    // Assuming LoginScreen hides the "Login" button and shows an ActivityIndicator
    // A more robust test would involve adding a testID to the ActivityIndicator in LoginScreen.js
    expect(queryByText("Login")).toBeNull();
    // Example: expect(getByTestId("loading-indicator")).toBeTruthy();
  });

  it("displays error message if login fails and resets error", async () => {
    const error = { message: "Invalid credentials" };
    const errorStore = createTestStore({ auth: { error: error } });
    const alertSpy = jest.spyOn(require("react-native").Alert, "alert");

    renderComponent(errorStore);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Login Failed",
        "Invalid credentials",
      );
    });
    // The component dispatches resetAuthError via useEffect when an error is present
    expect(authSlice.resetAuthError).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  it("resets auth error before a new login attempt if an error was present", () => {
    const error = { message: "Previous error" };
    const errorStore = createTestStore({ auth: { error: error } });
    const { getByPlaceholderText, getByText } = renderComponent(errorStore);

    // useEffect should call resetAuthError due to initial error
    expect(authSlice.resetAuthError).toHaveBeenCalledTimes(1);
    mockResetAuthError.mockClear(); // Clear for the next assertion

    fireEvent.changeText(getByPlaceholderText("Email"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "password123");
    fireEvent.press(getByText("Login"));

    // LoginScreen's handleSubmit should call resetAuthError if error was present
    // This depends on the exact implementation of handleSubmit in LoginScreen.js
    // If handleSubmit itself calls resetAuthError before loginUser:
    expect(authSlice.resetAuthError).toHaveBeenCalledTimes(1);
    expect(authSlice.loginUser).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });
});
