import { NavigationContainer } from "@react-navigation/native";
import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { Provider } from "react-redux";
import TradingScreen from "../../../screens/Main/TradingScreen";
import * as api from "../../../services/api"; // To mock API calls
import authReducer from "../../../store/slices/authSlice";

// Mock navigation with goBack
const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };

// Mock route with params
const mockRoute = {
  params: {
    creditId: "credit123",
    price: 25.5,
    availableAmount: 100,
  },
};

// Mock API service
jest.mock("../../../services/api", () => ({
  createTrade: jest.fn(),
}));

// Mock Alert
jest.spyOn(Alert, "alert");

const createTestStore = (initialState) => {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: initialState,
  });
};

describe("TradingScreen", () => {
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
    api.createTrade.mockClear();
    mockNavigation.navigate.mockClear();
    mockNavigation.goBack.mockClear();
    Alert.alert.mockClear();
  });

  const renderComponent = () => {
    const store = createTestStore(initialState);
    return render(
      <Provider store={store}>
        <NavigationContainer>
          <TradingScreen route={mockRoute} navigation={mockNavigation} />
        </NavigationContainer>
      </Provider>,
    );
  };

  it("renders correctly with credit details from route params", () => {
    const { getByText, getByPlaceholderText } = renderComponent();
    expect(getByText(/credit123/i)).toBeTruthy();
    expect(getByText(/\$25.50/)).toBeTruthy();
    expect(getByPlaceholderText("Enter amount to trade")).toBeTruthy();
  });

  it("validates amount input and shows error for invalid input", () => {
    const { getByPlaceholderText, getByText } = renderComponent();
    const amountInput = getByPlaceholderText("Enter amount to trade");
    const submitButton = getByText(/Confirm Buy Order/i);

    fireEvent.changeText(amountInput, "-5");
    fireEvent.press(submitButton);

    expect(Alert.alert).toHaveBeenCalledWith("Error", expect.any(String));
  });

  it("creates a trade successfully when valid amount is provided", async () => {
    api.createTrade.mockResolvedValue({ success: true });

    const { getByPlaceholderText, getByText } = renderComponent();
    const amountInput = getByPlaceholderText("Enter amount to trade");
    const submitButton = getByText(/Confirm Buy Order/i);

    fireEvent.changeText(amountInput, "10");
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(api.createTrade).toHaveBeenCalledWith({
        creditId: "credit123",
        amount: 10,
        price: 25.5,
        type: "buy",
      });
    });
  });

  it("displays error message when trade creation fails", async () => {
    api.createTrade.mockResolvedValue({
      success: false,
      error: { message: "Insufficient funds" },
    });

    const { getByPlaceholderText, getByText } = renderComponent();
    const amountInput = getByPlaceholderText("Enter amount to trade");
    const submitButton = getByText(/Confirm Buy Order/i);

    fireEvent.changeText(amountInput, "10");
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Insufficient funds");
    });
  });
});
