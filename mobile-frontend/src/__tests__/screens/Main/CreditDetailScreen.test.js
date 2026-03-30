import { NavigationContainer } from "@react-navigation/native";
import { configureStore } from "@reduxjs/toolkit";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Provider } from "react-redux";
import CreditDetailScreen from "../../../screens/Main/CreditDetailScreen";
import * as api from "../../../services/api";
import authReducer from "../../../store/slices/authSlice";

// Mock navigation
const mockNavigation = { navigate: jest.fn() };

// Mock route with params
const mockRoute = {
  params: {
    creditId: "credit123",
  },
};

// Mock API service
jest.mock("../../../services/api", () => ({
  getCreditById: jest.fn(),
}));

const createTestStore = (initialState) => {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: initialState,
  });
};

describe("CreditDetailScreen", () => {
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
    api.getCreditById.mockClear();
    mockNavigation.navigate.mockClear();
  });

  const renderComponent = () => {
    const store = createTestStore(initialState);
    return render(
      <Provider store={store}>
        <NavigationContainer>
          <CreditDetailScreen route={mockRoute} navigation={mockNavigation} />
        </NavigationContainer>
      </Provider>,
    );
  };

  it("displays loading indicator initially", () => {
    api.getCreditById.mockReturnValue(new Promise(() => {}));
    const { queryByText } = renderComponent();
    // Should show loading, so no error text yet
    expect(queryByText(/Error:/i)).toBeNull();
  });

  it("displays credit details after successful API call", async () => {
    const mockCredit = {
      success: true,
      data: {
        id: "credit123",
        type: "renewable_energy",
        amount: 100,
        price: 25.5,
        status: "available",
        verificationStatus: "verified",
        description: "Solar power project credits",
      },
    };
    api.getCreditById.mockResolvedValue(mockCredit);

    const { getByText } = renderComponent();
    await waitFor(() => {
      expect(getByText(/RENEWABLE ENERGY/i)).toBeTruthy();
      expect(getByText(/100 tCO2e/)).toBeTruthy();
      expect(getByText(/\$25.50/)).toBeTruthy();
    });
  });

  it("navigates to Trading screen when Initiate Trade button is pressed", async () => {
    const mockCredit = {
      success: true,
      data: {
        id: "credit123",
        type: "renewable_energy",
        amount: 100,
        price: 25.5,
        status: "available",
        verificationStatus: "verified",
        description: "Solar power project credits",
      },
    };
    api.getCreditById.mockResolvedValue(mockCredit);

    const { getByText } = renderComponent();
    await waitFor(() => {
      expect(getByText("Initiate Trade")).toBeTruthy();
    });

    const tradeButton = getByText("Initiate Trade");
    fireEvent.press(tradeButton);

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Trading", {
      creditId: "credit123",
      price: 25.5,
      availableAmount: 100,
    });
  });

  it("displays error message if fetching credit details fails", async () => {
    const mockError = {
      success: false,
      error: { message: "Credit not found" },
    };
    api.getCreditById.mockResolvedValue(mockError);

    const { getByText } = renderComponent();
    await waitFor(() => {
      expect(getByText(/Credit not found/i)).toBeTruthy();
    });
  });
});
