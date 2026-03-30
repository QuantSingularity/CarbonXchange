import { NavigationContainer } from "@react-navigation/native";
import { configureStore } from "@reduxjs/toolkit";
import { render, waitFor } from "@testing-library/react-native";
import { Provider } from "react-redux";
import WalletScreen from "../../../screens/Main/WalletScreen";
import * as api from "../../../services/api"; // To mock API calls
import authReducer from "../../../store/slices/authSlice";

// Mock navigation
const mockNavigation = { navigate: jest.fn() };

// Mock API service
jest.mock("../../../services/api", () => ({
  getWalletBalance: jest.fn(),
  getUserTrades: jest.fn(),
}));

// Mock Alert
jest.mock("react-native/Libraries/Alert/Alert", () => ({
  alert: jest.fn(),
}));

const createTestStore = (initialState) => {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: initialState,
  });
};

describe("WalletScreen", () => {
  const initialState = {
    auth: {
      user: { id: "user123" },
      token: "test-token",
      isLoggedIn: true,
      isLoading: false,
      isRehydrating: false,
      error: null,
    },
  };

  beforeEach(() => {
    api.getWalletBalance.mockClear();
    api.getUserTrades.mockClear();
    mockNavigation.navigate.mockClear();
  });

  const renderComponent = () => {
    const store = createTestStore(initialState);
    return render(
      <Provider store={store}>
        <NavigationContainer>
          <WalletScreen navigation={mockNavigation} />
        </NavigationContainer>
      </Provider>,
    );
  };

  it("renders correctly and shows loading indicator initially", () => {
    api.getWalletBalance.mockReturnValue(new Promise(() => {})); // Keep it pending
    api.getUserTrades.mockReturnValue(new Promise(() => {})); // Keep it pending
    const { queryByText } = renderComponent();
    expect(queryByText("My Wallet")).toBeTruthy();
  });

  it("displays wallet balance after successful API call", async () => {
    const mockBalance = {
      success: true,
      data: {
        tokenBalance: 1000,
        creditBalance: 50,
        pendingTrades: 2,
      },
    };
    api.getWalletBalance.mockResolvedValue(mockBalance);
    api.getUserTrades.mockResolvedValue({
      success: true,
      data: { trades: [], pages: 1 },
    });

    const { getByText } = renderComponent();
    await waitFor(() => {
      expect(getByText(/1,000 TOK/)).toBeTruthy();
      expect(getByText(/50 tCO2e/)).toBeTruthy();
    });
  });

  it("displays error message if fetching balance fails", async () => {
    const mockError = { success: false, error: { message: "Network Error" } };
    api.getWalletBalance.mockResolvedValue(mockError);
    api.getUserTrades.mockResolvedValue({
      success: true,
      data: { trades: [], pages: 1 },
    });

    const { getByText } = renderComponent();
    await waitFor(() => {
      expect(getByText(/Network Error/)).toBeTruthy();
    });
  });
});
