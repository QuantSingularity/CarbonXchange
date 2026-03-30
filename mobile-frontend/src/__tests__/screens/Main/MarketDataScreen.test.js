import { NavigationContainer } from "@react-navigation/native";
import { configureStore } from "@reduxjs/toolkit";
import { render, waitFor } from "@testing-library/react-native";
import { Provider } from "react-redux";
import MarketDataScreen from "../../../screens/Main/MarketDataScreen";
import * as api from "../../../services/api";
import authReducer from "../../../store/slices/authSlice";

// Mock API service
jest.mock("../../../services/api", () => ({
  getMarketStats: jest.fn(),
  getMarketForecast: jest.fn(),
}));

const createTestStore = (initialState) => {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: initialState,
  });
};

describe("MarketDataScreen", () => {
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
    api.getMarketStats.mockClear();
    api.getMarketForecast.mockClear();
  });

  const renderComponent = () => {
    const store = createTestStore(initialState);
    return render(
      <Provider store={store}>
        <NavigationContainer>
          <MarketDataScreen />
        </NavigationContainer>
      </Provider>,
    );
  };

  it("renders correctly and shows title", () => {
    api.getMarketStats.mockReturnValue(new Promise(() => {}));
    api.getMarketForecast.mockReturnValue(new Promise(() => {}));
    const { getByText } = renderComponent();
    expect(getByText("Market Overview")).toBeTruthy();
  });

  it("displays market statistics after successful API call", async () => {
    const mockStats = {
      success: true,
      data: {
        averagePrice: 25.75,
        priceChange24h: 2.5,
        volume24h: 50000,
        totalVolume: 1000000,
      },
    };
    api.getMarketStats.mockResolvedValue(mockStats);
    api.getMarketForecast.mockResolvedValue({
      success: true,
      data: {
        labels: ["Jan", "Feb"],
        datasets: [{ data: [25, 26] }],
      },
    });

    const { getByText } = renderComponent();
    await waitFor(() => {
      expect(getByText(/\$25.75/)).toBeTruthy();
    });
  });

  it("displays error message if fetching stats fails", async () => {
    const mockError = { success: false, error: { message: "API Error" } };
    api.getMarketStats.mockResolvedValue(mockError);
    api.getMarketForecast.mockResolvedValue({
      success: true,
      data: {
        labels: ["Jan"],
        datasets: [{ data: [25] }],
      },
    });

    const { getByText } = renderComponent();
    await waitFor(() => {
      expect(getByText(/API Error/)).toBeTruthy();
    });
  });
});
